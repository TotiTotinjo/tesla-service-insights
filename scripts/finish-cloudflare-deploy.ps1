# Finish Cloudflare deploy after creating an API token
# 1) https://dash.cloudflare.com/profile/api-tokens
#    Create Token -> "Edit Cloudflare Workers" template -> Continue -> Create
# 2) Run this script and paste the token when prompted

cd C:\Users\prelv\tesla-service-insights
gh secret set CLOUDFLARE_API_TOKEN -R TotiTotinjo/tesla-service-insights
gh workflow run "Deploy to Cloudflare Workers" -R TotiTotinjo/tesla-service-insights
Start-Sleep -Seconds 3
gh run list -R TotiTotinjo/tesla-service-insights --workflow "Deploy to Cloudflare Workers" --limit 1
Write-Host "Watch progress: gh run watch -R TotiTotinjo/tesla-service-insights"
