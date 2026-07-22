{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": false,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/", "destination": "/index.html" },
    { "source": "/painel", "destination": "/index.html" },
    { "source": "/atrasados", "destination": "/atrasados.html" },
    { "source": "/embalagem", "destination": "/embalagem.html" },
    { "source": "/admin", "destination": "/admin.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
