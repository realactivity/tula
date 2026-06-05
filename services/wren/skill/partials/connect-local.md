## Your Health Data

Your health records are included in this skill package in the `data/` directory.

Each file represents one healthcare provider you connected:

```
data/
  epic-sandbox.json      # Provider 1
  mayo-clinic.json       # Provider 2 (if connected)
```

To load the data:

```bash
# List available providers
ls data/

# Read a provider's data
cat data/epic-sandbox.json
```

Or in JavaScript:

```javascript
import { readFileSync, readdirSync } from 'fs';

// Load all providers
const dataDir = './data';
const providers = readdirSync(dataDir)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(`${dataDir}/${f}`, 'utf-8')));

// For single provider, use providers[0]
const data = providers[0];
```
