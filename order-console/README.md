# Order Console (standalone frontend)

A standalone React + Tailwind interface for the Customer Order Management API.

## Setup

```bash
npm install
npm run dev
```

Then open the URL it prints (typically `http://localhost:5173`).

## Requirements

Your backend API must be running first:
```bash
podman start sqlserver
cd ../OrderManagement.Api
dotnet run
```

Make sure CORS is enabled in `Program.cs`:
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
// ...
app.UseCors("AllowAll");
```

If your API runs on a different port than 5077, update `API_BASE` at the top of `src/OrderManagementConsole.jsx`.
