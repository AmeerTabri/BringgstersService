import express, { Request, Response } from "express";
import knex, { Knex } from "knex";
// If your knexfile uses CommonJS (module.exports = {...}),
// keep require to avoid TS/ESM interop hassles:
const knexfile = require("./knexfile");
import { createClient, RedisClientType } from "redis";

// arnavmq doesn't ship types; declare a minimal interface
type ArnavMQ = {
  publish<T = any, R = any>(
    queue: string,
    msg: T,
    opts?: { rpc?: boolean; timeout?: number; durable?: boolean }
  ): Promise<R>;
  subscribe<T = any, R = any>(
    queue: string,
    opts: { durable?: boolean },
    handler: (msg: T) => Promise<R> | R
  ): Promise<void>;
};
// initialized (no .connect() needed)
const arnavmq: ArnavMQ = require("arnavmq")({ host: "amqp://localhost" });

// ----------------------------- Setup -----------------------------
const app = express();
app.use(express.json());

const db: Knex = knex(knexfile.development);

// Redis
const redisClient: RedisClientType = createClient({ url: "redis://localhost:6379" });
redisClient.on("error", (err) => console.error("Redis error:", err));
(async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
})();

// Constants
const TTL = 5; // seconds
const ALL_KEY = "bringgsters:all";
const ID_KEY = (id: number | string) => `bringgster:id:${id}`;
const API_URL = "https://jsonplaceholder.typicode.com";

// ----------------------------- Types -----------------------------
interface Bringgster {
  id: number;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface NewBringgster {
  first_name: string;
  last_name: string;
  role: string;
}

type RpcRequest =
  | { type: "getAllBringgsters"; forceRefresh?: boolean }
  | { type: "getBringgsterById"; id: number }
  | { type: "createBringgster"; data: NewBringgster }
  | { type: "updateBringgster"; id: number; data: Partial<NewBringgster> }
  | { type: "deleteBringgster"; id: number };

// ----------------------------- Table bootstrap -----------------------------
async function createTables() {
  const exists = await db.schema.hasTable("bringgsters");
  if (!exists) {
    await db.schema.createTable("bringgsters", (table) => {
      table.increments("id").primary();
      table.string("first_name");
      table.string("last_name");
      table.string("role");
    });
  }
}
createTables();

// ----------------------------- Helpers -----------------------------

// get posts
async function getPosts(id: number) {
  const response = await fetch(`${API_URL}/posts?userId=${id}`);
  const posts = await response.json() as Array<{ id: number; title: string; body: string }>;
  return posts.map(({ id, title, body }) => ({ id, title, body }));
}

// get albums
async function getAlbums(id: number) {
  const response = await fetch(`${API_URL}/albums?userId=${id}`);
  const albums = await response.json() as Array<{ id: number; title: string }>;
  return albums.map(({ id, title }) => ({ id, title }));
}

// ----------------------------- Core (RPC) functions -----------------------------

// fetch all bringgsters
async function fetchBringgsters() {
  const cached = await redisClient.get(ALL_KEY);
  if (cached) {
    return {
      message: "Bringgsters fetched successfully (from cache)",
      bringgsters: JSON.parse(cached as string) as unknown,
    };
  }

  const bringgsters = (await db<Bringgster>("bringgsters").select("*")) as Bringgster[];

  const bringgstersWithPostsAndAlbums = await Promise.all(
    bringgsters.map(async (b) => {
      const [posts, albums] = await Promise.all([getPosts(b.id), getAlbums(b.id)]);
      return { ...b, posts, albums };
    })
  );

  await redisClient.set(ALL_KEY, JSON.stringify(bringgstersWithPostsAndAlbums), { EX: TTL });

  return {
    message: "Bringgsters fetched successfully",
    bringgsters: bringgstersWithPostsAndAlbums,
  };
}

// fetch bringgster by id
async function fetchBringgsterById(idRaw: number | string) {
  const id = typeof idRaw === "string" ? parseInt(idRaw, 10) : idRaw;

  const cached = await redisClient.get(ID_KEY(id));
  if (cached) {
    return {
      message: "Bringgster fetched successfully (from cache)",
      bringgster: JSON.parse(cached as string) as unknown,
    };
  }

  const bringgster = await db<Bringgster>("bringgsters").where("id", id).first();
  if (!bringgster) return { error: "Bringgster not found" };

  const [posts, albums] = await Promise.all([getPosts(bringgster.id), getAlbums(bringgster.id)]);
  const bringgsterWithPostsAndAlbums = { ...bringgster, posts, albums };

  await redisClient.set(ID_KEY(id), JSON.stringify(bringgsterWithPostsAndAlbums), { EX: TTL });

  return {
    message: "Bringgster fetched successfully",
    bringgster: bringgsterWithPostsAndAlbums,
  };
}

// create bringgster
async function createBringgster(data: Partial<NewBringgster>) {
  try {
    if (!data?.first_name || !data?.last_name || !data?.role) {
      return { error: "Missing required fields" };
    }
    if ((data.first_name as string).length >= 100 || (data.last_name as string).length >= 100 || (data.role as string).length >= 100) {
      return { error: "Field too long" };
    }

    const [created] = await db<Bringgster>("bringgsters")
      .insert({ first_name: data.first_name, last_name: data.last_name, role: data.role })
      .returning("*");

    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(created.id));

    return { message: "Bringgster created successfully", bringgster: created };
  } catch (err) {
    console.error("Error creating bringgster:", err);
    return { error: "Internal server error" };
  }
}

// update bringgster
async function updateBringgster(idRaw: number | string, data: Partial<NewBringgster>) {
  try {
    const id = typeof idRaw === "string" ? parseInt(idRaw, 10) : idRaw;

    const exists = await db<Bringgster>("bringgsters").where("id", id).first();
    if (!exists) return { error: "Bringgster not found" };

    const [updated] = await db<Bringgster>("bringgsters").where("id", id).update(data).returning("*");
    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(id));

    return { message: "Bringgster updated successfully", bringgster: updated };
  } catch (err) {
    console.error("Error updating bringgster:", err);
    return { error: "Internal server error" };
  }
}

// delete bringgster
async function deleteBringgster(idRaw: number | string) {
  try {
    const id = typeof idRaw === "string" ? parseInt(idRaw, 10) : idRaw;

    const deletedCount = await db("bringgsters").where("id", id).del();
    if (deletedCount === 0) return { error: "Bringgster not found" };

    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(id));

    return { message: "Bringgster deleted successfully", bringgster: deletedCount };
  } catch (err) {
    console.error("Error deleting bringgster:", err);
    return { error: "Internal server error" };
  }
}

// ----------------------------- HTTP Routes -----------------------------

// get all bringgsters
app.get("/bringgsters", async (_req: Request, res: Response) => {
  try {
    const result = await fetchBringgsters();
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching bringgsters:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// get bringgster by id
app.get("/bringgsters/:id", async (req: Request, res: Response) => {
  try {
    const bringgster = await db<Bringgster>("bringgsters").where("id", parseInt(req.params.id, 10)).first();
    if (!bringgster) return res.status(404).json({ error: "Bringgster not found" });
    res.status(200).json(bringgster);
  } catch (err) {
    console.error("Error fetching bringgster:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------------------- RabbitMQ (RPC) -----------------------------

arnavmq.subscribe<RpcRequest>("bringgsters", { durable: true }, async (msg) => {
  try {
    switch (msg?.type) {
      case "getAllBringgsters":
        return await fetchBringgsters();
      case "getBringgsterById":
        return await fetchBringgsterById(msg.id);
      case "createBringgster":
        return await createBringgster(msg.data);
      case "updateBringgster":
        return await updateBringgster(msg.id, msg.data);
      case "deleteBringgster":
        return await deleteBringgster(msg.id);
      default:
        return { error: "Unknown RPC type" };
    }
  } catch (err) {
    console.error("Error in RPC handler:", err);
    return { error: "Internal server error" };
  }
});

// ----------------------------- Start server -----------------------------
app.listen(8080, () => console.log("Server running on port 8080"));
