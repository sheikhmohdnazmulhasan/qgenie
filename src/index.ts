import { Document, FilterQuery, Model } from "mongoose";

export class QueryBuilder<T extends Document> {
  private query: ReturnType<Model<T>["find"]>;
  private queryString: Record<string, any>;

  constructor(
    modelQuery: ReturnType<Model<T>["find"]>,
    queryString: Record<string, any>
  ) {
    this.query = modelQuery;
    this.queryString = queryString;
  }

  search(fields: (keyof T)[] = []): this {
    if (this.queryString.search) {
      const searchRegex = new RegExp(this.queryString.search, "i");
      const searchConditions: Record<string, any>[] = fields.map((field) => ({
        [field as string]: searchRegex,
      }));

      if (searchConditions.length > 0) {
        this.query = this.query.find({ $or: searchConditions });
      }
    }
    return this;
  }

  filter(): this {
    const filterableFields = { ...this.queryString };
    const excludedFields = ["search", "sort", "page", "limit", "populate"];
    excludedFields.forEach((field) => delete filterableFields[field]);

    let queryStr = JSON.stringify(filterableFields);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr) as FilterQuery<T>);
    return this;
  }

  sort(defaultSort: string = "-createdAt"): this {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort(defaultSort);
    }
    return this;
  }

  paginate(defaultLimit: number = 10): this {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || defaultLimit;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }

  populate(fields: string | string[] | Record<string, any>[]): this {
    if (fields) {
      if (Array.isArray(fields)) {
        fields.forEach((field) => {
          if (typeof field === "string") {
            this.query = this.query.populate(field);
          } else if (typeof field === "object" && field.path) {
            // @ts-ignore: fix later
            this.query = this.query.populate(field);
          }
        });
      } else if (typeof fields === "string") {
        this.query = this.query.populate(fields);
      }
    }
    return this;
  }

  async exec() {
    const data = await this.query.exec();
    return data;
  }

  async executeWithMetadata() {
    const total = await this.query.model.countDocuments(this.query.getFilter());
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const totalPages = Math.ceil(total / limit);

    const data = await this.query.exec();
    return { meta: { total, page, limit, totalPages }, data };
  }
}
