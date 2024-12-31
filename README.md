# qgenie

A powerful and customizable query builder for Mongoose, simplifying complex aggregation and query construction with support for search, filter, sort, pagination, population and aggregation.

## Installation

To install qgenie, run the following command in your project directory:

```
npm install qgenie
```

## Usage

Here's a basic example of how to use qgenie in your project:

```typescript
import { QueryBuilder } from "qgenie";
import { YourMongooseModel } from "./your-model";

async function getItems(queryString: Record<string, any>) {
  const query = YourMongooseModel.find();
  const queryBuilder = new QueryBuilder(query, queryString);

  const result = await queryBuilder
    .search(["name", "description", "industry.name"])
    .filter()
    .sort()
    .paginate()
    .populate("category")
    .executeWithMetadata();

  return result;
}
```

## Features

### Search

Search across multiple or nested fields:

```typescript
queryBuilder.search(["name", "description"]);
// combine nested fields:
queryBuilder.search(["name", "description", "nested.field"]);
```

### Filter

Apply filters based on query parameters:

```typescript
queryBuilder.filter();
```

Supports operators like `gt`, `gte`, `lt`, `lte`, and `in`.

### Sort

Sort results:

```typescript
queryBuilder.sort("-createdAt");
```

### Paginate

Paginate results:

```typescript
queryBuilder.paginate(10); // 10 items per page
```

### Populate

Populate related fields:

```typescript
queryBuilder.populate("category");
// or
queryBuilder.populate(["category", "author"]);
// or
queryBuilder.populate([{ path: "category", select: "name" }]);
// or
queryBuilder.populate([{ path: "category", select: ["name", "status"] }]);
// or
queryBuilder.populate([
  { path: "category", select: ["name", "status"] },
  { path: "user" },
]);
```

### Execute Query

Execute the query:

```typescript
const data = await queryBuilder.exec();
```

### Execute with Metadata

Execute the query and get metadata:

```typescript
const { meta, data } = await queryBuilder.executeWithMetadata();
```

### Aggregation

Perform aggregation using qgenie:

```typescript
const aggregationPipeline = [
  { $match: { status: "active" } },
  { $group: { _id: "$category", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
];

const aggregatedResult = await queryBuilder.aggregate(aggregationPipeline);
```

## Example

Here's an example of a complex query string that demonstrates various features of qgenie:

```
?search=smartphone&category=electronics&price[gte]=500&price[lte]=1000&inStock=true&sort=-price,name&page=2&limit=20&populate=manufacturer
```

This query string does the following:

1. Searches for "smartphone" in the specified search fields
2. Filters for items in the "electronics" category
3. Filters for items with a price between $500 and $1000
4. Filters for items that are in stock
5. Sorts results by price (descending) and then by name (ascending)
6. Requests the second page of results with 20 items per page
7. Populates the manufacturer field in the results

Here's how you would use this query string with qgenie:

```typescript
import { QueryBuilder } from "qgenie";
import { Product } from "./your-product-model";

async function getProducts(queryString: Record<string, any>) {
  const query = Product.find();
  const queryBuilder = new QueryBuilder(query, queryString);

  const result = await queryBuilder
    .search(["name", "description"])
    .filter()
    .sort()
    .paginate()
    .populate("manufacturer")
    .executeWithMetadata();

  return result;
}

// Usage
const queryString = {
  search: "smartphone",
  category: "electronics",
  "price[gte]": "500",
  "price[lte]": "1000",
  inStock: "true",
  sort: "-price,name",
  page: "2",
  limit: "20",
  populate: "manufacturer",
};

const products = await getProducts(queryString);
console.log(products);
```

### Aggregation Example

Here's an example demonstrating how to use the aggregation feature:

```typescript
import { QueryBuilder } from "qgenie";
import { Order } from "./your-order-model";

async function getSalesData() {
  const query = Order.find();
  const queryBuilder = new QueryBuilder(query, {});

  const aggregationPipeline = [
    { $match: { status: "completed" } },
    { $group: { _id: "$region", totalSales: { $sum: "$amount" } } },
    { $sort: { totalSales: -1 } },
  ];

  const aggregatedResult = await queryBuilder.aggregate(aggregationPipeline);

  return aggregatedResult;
}

// Usage
const salesData = await getSalesData();
console.log(salesData);
```

This example aggregates sales data by region, calculating the total sales amount for each region and sorting the results in descending order of total sales.

## API Reference

### QueryBuilder<T>

- `constructor(modelQuery: ReturnType<Model<T>["find"]>, queryString: Record<string, any>)`
- `search(fields: (keyof T)[]): this`
- `filter(): this`
- `sort(defaultSort: string): this`
- `paginate(defaultLimit: number): this`
- `populate(fields: string | string[] | Record<string, any>[]): this`
- `aggregate(pipeline: Record<string, any>[]): Promise<any[]>`
- `async exec(): Promise<T[]>`
- `async executeWithMetadata(): Promise<{ meta: { total: number, page: number, limit: number, totalPages: number }, data: T[] }>`
