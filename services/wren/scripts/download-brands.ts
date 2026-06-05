#!/usr/bin/env bun
/**
 * Download and preprocess Epic User-access Brands Bundle.
 * 
 * The full bundle from https://open.epic.com/Endpoints/Brands is large (~50MB).
 * This script downloads it, parses the FHIR Bundle, and creates smaller
 * browser-friendly JSON files.
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const BRANDS_URL = "https://open.epic.com/Endpoints/Brands";
const PROJECT_DIR = dirname(dirname(import.meta.path));
const BRANDS_DIR = join(PROJECT_DIR, "brands");
const RAW_DIR = join(BRANDS_DIR, "raw");

async function main() {
  // Ensure directories exist
  mkdirSync(RAW_DIR, { recursive: true });

  console.log("Downloading Epic User-access Brands Bundle...");
  console.log(`URL: ${BRANDS_URL}`);
  
  const response = await fetch(BRANDS_URL, {
    headers: { Accept: "application/json" },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  
  const rawData = await response.json() as Record<string, any>;
  const rawPath = join(RAW_DIR, "epic-brands.json");
  writeFileSync(rawPath, JSON.stringify(rawData));
  console.log(`Saved raw data to ${rawPath}`);
  
  // Parse the FHIR Bundle
  if (rawData.resourceType !== "Bundle") {
    throw new Error("Expected FHIR Bundle");
  }
  
  console.log(`Processing ${rawData.entry?.length || 0} entries...`);
  
  // Index resources by fullUrl (urn:uuid format) and by ID
  const resourcesByUrl = new Map<string, any>();
  const organizations: any[] = [];
  const endpoints: any[] = [];
  
  for (const entry of rawData.entry || []) {
    const resource = entry.resource;
    if (!resource) continue;
    
    // Index by fullUrl (urn:uuid:...) for reference lookups
    if (entry.fullUrl) {
      resourcesByUrl.set(entry.fullUrl, resource);
    }
    
    if (resource.resourceType === "Organization") {
      organizations.push({ ...resource, _fullUrl: entry.fullUrl });
    } else if (resource.resourceType === "Endpoint") {
      endpoints.push({ ...resource, _fullUrl: entry.fullUrl });
    }
  }
  
  console.log(`Found ${organizations.length} organizations, ${endpoints.length} endpoints`);
  
  // Build endpoint lookup by fullUrl
  const endpointByUrl = new Map<string, any>();
  for (const ep of endpoints) {
    endpointByUrl.set(ep._fullUrl, {
      url: ep.address,
      name: ep.name,
      connectionType: ep.connectionType?.code,
    });
  }
  
  // Process organizations
  const brands: any[] = [];
  const facilities: any[] = [];
  
  for (const org of organizations) {
    const item: any = {
      id: org.id,
      displayName: org.name || "Unknown",
      brandName: org.name || "Unknown",
    };
    
    // Extract address
    if (org.address?.length > 0) {
      const addr = org.address[0];
      item.city = addr.city || null;
      item.state = addr.state || null;
      item.postalCode = addr.postalCode || null;
    }
    
    if (org.partOf?.reference) {
      // Facility - has parent brand
      item.itemType = "facility";
      item.brandRef = org.partOf.reference;
      
      const parent = resourcesByUrl.get(org.partOf.reference);
      if (parent) {
        item.brandName = parent.name || item.brandName;
        item.brandId = parent.id;
        
        // Get endpoints from parent brand
        if (parent.endpoint?.length > 0) {
          item.endpoints = [];
          for (const epRef of parent.endpoint) {
            const ep = endpointByUrl.get(epRef.reference);
            if (ep) {
              item.endpoints.push(ep);
            }
          }
        }
      }
      
      facilities.push(item);
    } else if (org.endpoint?.length > 0) {
      // Brand with endpoints
      item.itemType = "brand";
      item.brandId = org.id;
      item.endpoints = [];
      
      for (const epRef of org.endpoint) {
        const ep = endpointByUrl.get(epRef.reference);
        if (ep) {
          item.endpoints.push(ep);
        }
      }
      
      // Only include brands with FHIR endpoints
      if (item.endpoints.some((ep: any) => ep.url)) {
        brands.push(item);
      }
    }
  }
  
  console.log(`Processed ${brands.length} brands, ${facilities.length} facilities`);
  
  // Create combined list with search field
  const allItems = [...brands, ...facilities].map(item => ({
    ...item,
    searchName: [
      item.displayName,
      item.brandName,
      item.city,
      item.state,
    ].filter(Boolean).join(" ").toLowerCase(),
  }));
  
  allItems.sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  // Write production file
  const prodOutput = {
    items: allItems,
    processedTimestamp: new Date().toISOString(),
    stats: {
      totalBrands: brands.length,
      totalFacilities: facilities.length,
      totalItems: allItems.length,
    },
  };
  
  const prodPath = join(BRANDS_DIR, "epic-prod.json");
  writeFileSync(prodPath, JSON.stringify(prodOutput, null, 2));
  const prodSize = (Bun.file(prodPath).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${prodPath} (${prodSize} MB)`);
  
  // Write sandbox file (just the Epic sandbox endpoint)
  const sandboxOutput = {
    items: [
      {
        id: "epic-sandbox",
        displayName: "Epic FHIR Sandbox",
        brandName: "Epic FHIR Sandbox",
        itemType: "brand",
        brandId: "epic-sandbox",
        state: "WI",
        endpoints: [
          {
            url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/",
            name: "Epic Sandbox FHIR R4 API Endpoint",
          },
        ],
        searchName: "epic fhir sandbox wi",
      },
    ],
    processedTimestamp: new Date().toISOString(),
  };
  
  const sandboxPath = join(BRANDS_DIR, "epic-sandbox.json");
  writeFileSync(sandboxPath, JSON.stringify(sandboxOutput, null, 2));
  console.log(`Wrote ${sandboxPath}`);
  
  console.log("\n✓ Brands preprocessing complete!");
}

main().catch(console.error);
