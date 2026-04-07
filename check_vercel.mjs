import fs from 'fs';

async function checkDeploy() {
  const envContent = fs.readFileSync('a:/SiliconFeed/backend/.env', 'utf-8');
  
  const tokenMatch = envContent.match(/VERCEL_TOKEN="([^"]+)"/);
  const projectMatch = envContent.match(/VERCEL_PROJECT_ID="([^"]+)"/);

  if (!tokenMatch || !projectMatch) {
    console.log("Tokens not found in .env");
    return;
  }

  const token = tokenMatch[1];
  const projectId = projectMatch[1];

  try {
    const response = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    
    if (data.deployments && data.deployments.length > 0) {
      const dep = data.deployments[0];
      console.log(`STATUS: ${dep.state}`);
      console.log(`URL: https://${dep.url}`);
      console.log(`CREATED: ${new Date(dep.createdAt).toLocaleString()}`);
    } else {
      console.log("No deployments found.");
    }
  } catch (err) {
    console.log("Error fetching Vercel:", err.message);
  }
}

checkDeploy();
