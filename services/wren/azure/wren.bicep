// Wren records relay on Azure Container Apps.
// Deployed via `az deployment group create` (core CLI) because the
// `containerapp` CLI extension fails to install on this Windows host.
//
// Image pull uses a user-assigned managed identity with AcrPull on the
// existing (shared) registry - no ACR admin user, no stored credentials.

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container Apps managed environment name.')
param envName string = 'wren-cae'

@description('Container app name.')
param appName string = 'wren'

@description('Log Analytics workspace name.')
param logAnalyticsName string = 'wren-logs'

@description('ACR login server, e.g. myregistry.azurecr.io')
param acrLoginServer string

@description('Fully qualified image reference, e.g. myregistry.azurecr.io/wren:latest')
param image string

@description('Resource ID of the user-assigned identity that has AcrPull on the registry.')
param uamiResourceId string

@description('Storage account holding the JWKS file share.')
param storageAccountName string

@description('Storage account key (data-plane) for the file share.')
@secure()
param storageAccountKey string

@description('File share name that holds the wren/ JWKS subfolder.')
param fileShareName string

@description('Public base URL the app is served at.')
param baseURL string = 'https://wren.realactivity.ai'

@description('Revision suffix - bump to force a new revision that re-pulls :latest.')
param revisionSuffix string = ''

@description('Custom domain to bind (e.g. wren.realactivity.ai). Empty = skip until DNS is ready.')
param customDomain string = ''

var storageMountName = 'wrenkeys'
var bindCustomDomain = !empty(customDomain)

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: storageMountName
  properties: {
    azureFile: {
      accountName: storageAccountName
      accountKey: storageAccountKey
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

// Free managed certificate for the custom domain. Requires the CNAME and
// asuid TXT records to already resolve, or issuance fails.
resource cert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (bindCustomDomain) {
  parent: env
  name: 'wren-cert'
  location: location
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  // Volume references the env storage by name (string), so the dependency is
  // not inferred - declare it explicitly.
  dependsOn: [
    envStorage
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uamiResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        customDomains: bindCustomDomain ? [
          {
            name: customDomain
            bindingType: 'SniEnabled'
            certificateId: cert.id
          }
        ] : []
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acrLoginServer
          identity: uamiResourceId
        }
      ]
    }
    template: {
      revisionSuffix: revisionSuffix
      containers: [
        {
          name: 'wren'
          image: image
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'ENABLE_TEST_PROVIDER'
              value: 'false'
            }
            {
              name: 'BASE_URL'
              value: baseURL
            }
            {
              name: 'CONFIG_PATH'
              value: './config.prod.json'
            }
            {
              name: 'PORT'
              value: '8000'
            }
          ]
          volumeMounts: [
            {
              volumeName: storageMountName
              mountPath: '/mnt/wren'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 5
              periodSeconds: 15
            }
          ]
        }
      ]
      volumes: [
        {
          name: storageMountName
          storageType: 'AzureFile'
          storageName: storageMountName
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output customDomainVerificationId string = app.properties.customDomainVerificationId
