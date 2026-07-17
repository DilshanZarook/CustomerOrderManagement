# CustomerOrderManagement

![alt text](<InterfaceScreenshot/Screenshot 2026-07-16 at 11.58.36 AM.png>) ![alt text](<InterfaceScreenshot/Screenshot 2026-07-16 at 11.58.57 AM.png>) ![atl text](<InterfaceScreenshot/Screenshot 2026-07-17 at 11.07.11 AM.png>) ![alt text](<InterfaceScreenshot/Screenshot 2026-07-16 at 11.59.15 AM.png>) ![alt text](<InterfaceScreenshot/Screenshot 2026-07-16 at 11.59.22 AM.png>)

A simple Customer Order Management System built with ASP.NET Core Web API, Entity Framework Core, and SQL Server. Supports full CRUD for customers and products, and order creation with automatic stock validation and total calculation.

## Tech Stack

- C# / .NET 8
- ASP.NET Core Web API (controller-based)
- Entity Framework Core (Code-First, migrations)
- SQL Server (via Docker/Podman container — see [Database Setup](#database-setup))
- Swagger / OpenAPI
- Git

## Project Structure

```
OrderManagement.Api/
├── Controllers/
│   ├── CustomersController.cs
│   ├── ProductsController.cs
│   └── OrdersController.cs
├── Models/
│   ├── Customer.cs
│   ├── Product.cs
│   ├── Order.cs
│   └── OrderItem.cs
├── DTOs/
│   ├── CustomerDto.cs
│   ├── ProductDto.cs
│   └── OrderDto.cs
├── Data/
│   └── AppDbContext.cs
├── Middleware/
│   └── ExceptionMiddleware.cs
├── Migrations/
├── Program.cs
└── appsettings.json
```

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- A running SQL Server instance (see below — this project was developed and tested against **SQL Server in a container**, not LocalDB)
- Git
- (Optional but recommended) [VS Code](https://code.visualstudio.com/) with the **SQL Server (mssql)** extension, or Postman, for inspecting the database/API directly

## Database Setup

> **Note for Windows / Visual Studio users:** if you have SQL Server LocalDB or SQL Express installed locally, you can skip the container steps below and just point the connection string in `appsettings.json` at your local instance, e.g.:
> ```
> Server=(localdb)\mssqllocaldb;Database=OrderManagementDb;Trusted_Connection=True;TrustServerCertificate=True
> ```

This project was built and tested on **macOS (Apple Silicon)**, where LocalDB is not available and standard SQL Server Docker images don't run reliably. The setup below uses **Podman** (Docker-compatible) with **Azure SQL Edge** (Microsoft's ARM64-native SQL Server-compatible image).

### 1. Install Podman (or Docker)
```bash
brew install podman
podman machine init
podman machine start
```

### 2. Run SQL Server (Azure SQL Edge) in a container
```bash
podman run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Pass123" \
  -p 1433:1433 --name sqlserver -d mcr.microsoft.com/azure-sql-edge
```

> If you're on an Intel Mac or Windows/Linux, you can use full SQL Server instead:
> ```bash
> podman run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Pass123" \
>   -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:2022-latest
> ```

### 3. Confirm it's running
```bash
podman ps
```
You should see `sqlserver` with status `Up` and port `0.0.0.0:1433->1433/tcp`.

**Remember:** every time you restart your machine, you'll need to start the container again before running the API:
```bash
podman machine start
podman start sqlserver
```

### 4. Connection string
Already configured in `appsettings.json`:
```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost,1433;Database=OrderManagementDb;User Id=sa;Password=YourStrong@Pass123;TrustServerCertificate=True;MultipleActiveResultSets=true"
}
```

### 5. Apply migrations
```bash
cd OrderManagement.Api
dotnet ef database update
```
This creates the `OrderManagementDb` database with all four tables (`Customers`, `Products`, `Orders`, `OrderItems`).

## Running the API

```bash
cd OrderManagement.Api
dotnet run
```
The API will start on `http://localhost:5077` (port may vary — check the console output).

Open Swagger UI to explore and test all endpoints interactively:
```
http://localhost:5077/swagger
```

## API Endpoints

### Customers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/{id}` | Get a customer by id |
| GET | `/api/customers/search?name=` | Search customers by name |
| POST | `/api/customers` | Create a customer |
| PUT | `/api/customers/{id}` | Update a customer |
| DELETE | `/api/customers/{id}` | Delete a customer (blocked if they have orders) |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| GET | `/api/products/{id}` | Get a product by id |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product (blocked if used in an order) |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/orders` | List all orders (id, customer, date, total) |
| GET | `/api/orders/{id}` | Get full order detail (customer + line items) |
| POST | `/api/orders` | Create an order — validates stock, reduces stock, calculates total |

## Validation Rules

- Customer: `Name` and `Phone` required, `Email` required + unique
- Product: `Price` must be > 0, `Stock` cannot be negative
- Order: `Quantity` must be > 0 per item; order is **rejected entirely** if any single item has insufficient stock — no partial orders are created
- Order creation runs inside a **database transaction**: if any step fails, all changes (order, order items, stock updates) are rolled back together

## Business Logic Notes

- **Order total** is calculated server-side from the product's current price at the time of order — not trusted from client input.
- **Stock validation happens before any writes.** All requested items are checked against available stock first; only if every item passes does the system create the order and deduct stock. This guarantees no partial/inconsistent state if one item in a multi-item order fails.
- **Deleting a Customer** is blocked if they have existing orders (referential integrity, avoids orphaned orders).
- **Deleting a Product** is blocked if it appears in any existing order item, for the same reason.

## Testing

All endpoints were manually tested end-to-end via Swagger, covering:
- Successful create/read/update/delete flows for Customers and Products
- Duplicate email rejection (400)
- Not-found handling (404) for missing ids
- Order creation with multiple line items, confirming correct total calculation and stock deduction
- Order rejection when requested quantity exceeds available stock (400), confirming the transaction correctly rolled back and stock was left unchanged

A Postman collection covering all endpoints with example requests is included: `OrderManagement.postman_collection.json`.

## Challenges Faced During Development

This project was built on an Apple Silicon Mac, which introduced a few environment-specific hurdles worth documenting for anyone reproducing the setup:

1. **LocalDB is Windows-only.** `dotnet ef database update` initially failed with `System.PlatformNotSupportedException: LocalDB is not supported on this platform`, since the assignment's suggested connection string assumes SQL Server LocalDB, which doesn't exist on macOS. Resolved by running SQL Server in a container instead.

2. **Standard SQL Server image doesn't run on Apple Silicon.** The official `mcr.microsoft.com/mssql/server:2022-latest` image is x86_64-only. Under Podman's emulation layer on an M-series Mac, it consistently crashed on startup with a segmentation fault (`Segmentation fault (core dumped)`), rather than running (even slowly) under emulation. Resolved by switching to `mcr.microsoft.com/azure-sql-edge`, Microsoft's ARM64-native SQL Server-compatible image, which runs natively without emulation.

3. **Homebrew/Podman architecture mismatch.** Installing Podman via Homebrew initially failed with `podman: The arm64 architecture is required for this software`, because Homebrew itself had been installed as the x86_64 build (running under Rosetta) rather than the native arm64 build. Resolved by reinstalling Homebrew natively to `/opt/homebrew` and reinstalling Podman from there.

4. **Leftover/conflicting containers.** Several early attempts left stale containers (from earlier failed runs with the wrong image) occupying the `sqlserver` container name and port `1433`, causing `"the container name sqlserver is already in use"` and `"Could not open a connection to SQL Server"` errors on later attempts. Resolved by explicitly removing (`podman rm -f sqlserver`) and recreating the container with the correct image each time state got inconsistent.

5. **No `sqlcmd` inside the Azure SQL Edge image.** Unlike the full SQL Server image, Azure SQL Edge doesn't ship `sqlcmd`, so verifying table creation from inside the container wasn't possible. Resolved by using a GUI tool (VS Code + the SQL Server (mssql) extension) to connect to `localhost,1433` directly instead.

6. **Azure Data Studio is retired.** The originally planned DB-browsing tool, Azure Data Studio, was retired by Microsoft as of February 28, 2026, and is no longer available for direct download. Switched to VS Code with the official **SQL Server (mssql)** extension, which is Microsoft's current recommended replacement and provides equivalent object explorer / table browsing functionality.

7. **Port already in use on restart.** Restarting the API after a previous run wasn't cleanly stopped resulted in `Failed to bind to address http://127.0.0.1:5077: address already in use`. Resolved by ensuring the previous `dotnet run` process was terminated (`Ctrl+C`, or `pkill -9 dotnet` if orphaned) before restarting.

## Local Development Checklist

Every time you sit down to work on or run this project fresh:
```bash
podman machine start   # start the Podman VM
podman start sqlserver # start the SQL Server container
cd OrderManagement.Api
dotnet run              # start the API
```
Then open `http://localhost:5077/swagger` to interact with it.

## Author's Notes / Assumptions

- Order totals and unit prices are captured at time of order (from the product's current price), so future product price changes don't retroactively affect historical order totals.
- Customer and Product deletions are soft-blocked (400 response) rather than cascading, to preserve order history integrity.
- The connection string and SA password in this repository are for local development only and are not intended for production use.

