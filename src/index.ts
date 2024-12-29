import mongoose, {
  Document,
  FilterQuery,
  Model,
  PipelineStage,
} from "mongoose";

/**
 * QueryBuilder class for managing and executing queries with Mongoose models.
 * Provides utilities for searching, filtering, sorting, pagination, and aggregation.
 */
export class QueryBuilder<T extends Document> {
  private query: ReturnType<Model<T>["find"]>; // Holds the Mongoose query object
  private queryString: Record<string, any>; // Query parameters from the client
  private aggregatePipeline: PipelineStage[]; // Aggregation pipeline stages
  private isAggregation: boolean; // Flag to determine if aggregation is being used

  constructor(
    modelQuery: ReturnType<Model<T>["find"]>, // Mongoose model query
    queryString: Record<string, any> // Query string from request
  ) {
    this.query = modelQuery;
    this.queryString = queryString;
    this.aggregatePipeline = [];
    this.isAggregation = false;

    console.log(
      "\nYou are using qgenie for this query. \n" +
        "💡 If you find this package useful, please consider giving it a star on GitHub! 🌟\n" +
        "GitHub: https://github.com/sheikhmohdnazmulhasan/qgenie"
    );
  }

  /**
   * Logs the time taken for query execution.
   * @param startTime - Start time of the query
   */
  private logExecutionTime(startTime: [number, number]) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const elapsedMs = (seconds * 1e3 + nanoseconds / 1e6).toFixed(2);
    console.log(`Query executed in ${elapsedMs} ms`);
  }

  /**
   * Adds search functionality using the provided fields and query string.
   * @param fields - Array of fields to search
   * @returns this - The QueryBuilder instance
   */
  search(fields: (keyof T)[] = []): this {
    if (this.queryString.search) {
      const searchRegex = new RegExp(this.queryString.search, "i"); // Case-insensitive regex
      const searchConditions: Record<string, any>[] = fields.map((field) => ({
        [field as string]: searchRegex,
      }));

      if (searchConditions.length > 0) {
        if (this.isAggregation) {
          this.aggregatePipeline.push({ $match: { $or: searchConditions } });
        } else {
          this.query = this.query.find({ $or: searchConditions });
        }
      }
    }
    return this;
  }

  /**
   * Applies filtering based on query string parameters.
   * Removes non-filterable fields and supports MongoDB operators like $gt, $lt, etc.
   * @returns this - The QueryBuilder instance
   */
  filter(): this {
    const filterableFields = { ...this.queryString };
    const excludedFields = ["search", "sort", "page", "limit", "populate"];
    excludedFields.forEach((field) => delete filterableFields[field]);

    let queryStr = JSON.stringify(filterableFields);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    const parsedQuery = JSON.parse(queryStr) as FilterQuery<T>;
    if (this.isAggregation) {
      this.aggregatePipeline.push({ $match: parsedQuery });
    } else {
      this.query = this.query.find(parsedQuery);
    }
    return this;
  }

  /**
   * Adds sorting to the query based on the query string or a default sort order.
   * @param defaultSort - Default sorting field
   * @returns this - The QueryBuilder instance
   */
  sort(defaultSort: string = "-createdAt"): this {
    const sortBy = this.queryString.sort
      ? this.queryString.sort.split(",").join(" ")
      : defaultSort;

    if (this.isAggregation) {
      const sortObj = sortBy
        .split(" ")
        .reduce((acc: { [x: string]: number }, curr: string) => {
          const [field, order] = curr.startsWith("-")
            ? [curr.slice(1), -1]
            : [curr, 1];
          acc[field] = order;
          return acc;
        }, {});
      this.aggregatePipeline.push({ $sort: sortObj });
    } else {
      this.query = this.query.sort(sortBy);
    }
    return this;
  }

  /**
   * Implements pagination by applying skip and limit to the query.
   * @param defaultLimit - Default limit per page
   * @returns this - The QueryBuilder instance
   */
  paginate(defaultLimit: number = 10): this {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || defaultLimit;
    const skip = (page - 1) * limit;

    if (this.isAggregation) {
      this.aggregatePipeline.push({ $skip: skip }, { $limit: limit });
    } else {
      this.query = this.query.skip(skip).limit(limit);
    }
    return this;
  }

  /**
   * Adds population for related fields.
   * Supports both Mongoose populate and aggregation $lookup.
   * @param fields - Fields to populate
   * @returns this - The QueryBuilder instance
   */
  populate(fields: string | string[] | mongoose.PopulateOptions[]): this {
    if (fields) {
      if (this.isAggregation) {
        // Use $lookup for aggregation
        if (Array.isArray(fields)) {
          fields.forEach((field) => {
            if (typeof field === "string") {
              this.aggregatePipeline.push({
                $lookup: {
                  from: field,
                  localField: field,
                  foreignField: "_id",
                  as: field,
                },
              });
            } else if (typeof field === "object" && field.path) {
              this.aggregatePipeline.push({
                $lookup: {
                  from: field.path,
                  localField: field.path,
                  foreignField: "_id",
                  as: field.path,
                },
              });
            }
          });
        } else if (typeof fields === "string") {
          this.aggregatePipeline.push({
            $lookup: {
              from: fields,
              localField: fields,
              foreignField: "_id",
              as: fields,
            },
          });
        }
      } else {
        if (Array.isArray(fields)) {
          fields.forEach((field) => {
            if (typeof field === "string") {
              this.query = this.query.populate(field);
            } else if (typeof field === "object" && field.path) {
              this.query = this.query.populate(field);
            }
          });
        } else if (typeof fields === "string") {
          this.query = this.query.populate(fields);
        }
      }
    }
    return this;
  }

  /**
   * Switches the query mode to aggregation and sets an initial pipeline.
   * @param pipeline - Aggregation pipeline
   * @returns this - The QueryBuilder instance
   */
  aggregate(pipeline: PipelineStage[]): this {
    this.isAggregation = true;
    this.aggregatePipeline = pipeline;
    return this;
  }

  /**
   * Executes the query or aggregation and returns the results.
   * Logs execution time for performance monitoring.
   * @returns Promise<T[]> - Query results
   */
  async exec() {
    const startTime = process.hrtime(); // Start timing the query
    let result;

    if (this.isAggregation) {
      result = await this.query.model.aggregate(this.aggregatePipeline);
    } else {
      result = await this.query.exec();
    }

    this.logExecutionTime(startTime); // Log query execution time
    return result;
  }

  /**
   * Executes the query or aggregation and returns the results along with metadata.
   * Logs execution time for performance monitoring.
   * @returns Promise<{ meta: object; data: T[] }>
   */
  async executeWithMetadata() {
    const startTime = process.hrtime(); // Start timing the query
    let total: number;
    let data: T[];

    if (this.isAggregation) {
      const countPipeline = [...this.aggregatePipeline];
      countPipeline.push({ $count: "total" });
      const countResult = await this.query.model.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      data = await this.query.model.aggregate(this.aggregatePipeline);
    } else {
      total = await this.query.model.countDocuments(this.query.getFilter());
      data = (await this.query.exec()) as T[];
    }

    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const totalPages = Math.ceil(total / limit);

    this.logExecutionTime(startTime); // Log query execution time
    return { meta: { total, page, limit, totalPages }, data };
  }
}
