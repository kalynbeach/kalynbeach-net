import { MergeDeep } from "type-fest";
import { Database as DatabaseGenerated } from "./database-generated";

// export { Json } from "./database-generated";

export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Tables: {
        users: {
          Row: {
            id: string;
          };
        };
      };
    };
  }
>;
