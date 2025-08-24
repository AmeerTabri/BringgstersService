import express, { Request, Response } from "express";
import knex, { Knex } from "knex";
import knexfile from "./knexfile.js";
import { createClient } from "redis";
import arnavmq from "arnavmq";

//----------------------------- Setup -----------------------------

const app = express();
app.use(express.json());

const db = knex(knexfile.development);

// connect to Redis
const redisClient = createClient({ url: "redis://localhost:6379" });
redisClient.on("error", (err: Error) => console.error("Redis error:", err));
(async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
})();


const TTL = 5; // 5 seconds
const ALL_KEY = "bringgsters:all";
const ID_KEY = (id: number | string) => `bringgster:id:${id}`;
const URL = "https://jsonplaceholder.typicode.com";

const mq = arnavmq({ host: "amqp://localhost" });

// create bringgsters table
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

//----------------------------- Helper functions -----------------------------

// get all posts for a bringgster
async function getPosts(id: number): Promise<Array<{ id: number; title: string; body: string }>> {
  const response = await fetch(`${URL}/posts?userId=${id}`);
  const posts = await response.json() as Array<{ id: number; title: string; body: string }>;
  if (posts.length === 0) {
    return [];
  }
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
  }));
}

// get all albums for a bringgster
async function getAlbums(id: number): Promise<Array<{ id: number; title: string }>> {
  const response = await fetch(`${URL}/albums?userId=${id}`);
  const albums = await response.json() as Array<{ id: number; title: string }>;
  if (albums.length === 0) {
    return [];
  }
  return albums.map((album) => ({
    id: album.id,
    title: album.title,
  }));
}

//----------------------------- RPC functions -----------------------------

// get all bringgsters
async function fetchBringgsters() {
  const cached = await redisClient.get(ALL_KEY);
  if (cached) {
    return {
      message: "Bringgsters fetched successfully (from cache)",
      bringgsters: JSON.parse(cached as string),
    };
  }

  const bringgsters = await db("bringgsters").select("*");
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

// get bringgster by id
async function fetchBringgsterById(id) {
  const cached = await redisClient.get(ID_KEY(id));
  if (cached) {
    return {
      message: "Bringgster fetched successfully (from cache)",
      bringgster: JSON.parse(cached as string),
    };
  }
  const bringgster = await db("bringgsters").where("id", id).first();
  if (!bringgster) {
    return { error: "Bringgster not found" };
  }

  const [posts, albums] = await Promise.all([getPosts(bringgster.id), getAlbums(bringgster.id)]);
  const bringgsterWithPostsAndAlbums = { ...bringgster, posts, albums };

  await redisClient.set(ID_KEY(id), JSON.stringify(bringgsterWithPostsAndAlbums), { EX: TTL });

  return {
    message: "Bringgster fetched successfully",
    bringgster: bringgsterWithPostsAndAlbums,
  };
}

// create bringgster
async function createBringgster(data) {
  try {
    console.log("Creating bringgster:", data);
    if (!data.first_name || !data.last_name || !data.role) {
      return { error: "Missing required fields" };
    }
    if (data.first_name.length >= 100 || data.last_name.length >= 100 || data.role.length >= 100) {
      return { error: "Field too long" };
    }
    const [newBringgster] = await db("bringgsters")
      .insert({
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
      })
      .returning("*");

    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(newBringgster.id));

    return {
      message: "Bringgster created successfully",
      bringgster: newBringgster,
    };
  } catch (error) {
    console.error("Error creating bringgster:", error);
    return { error: "Internal server error" };
  }
}

// update bringgster
async function updateBringgster(id, data) {
  try {
    console.log("Updating bringgster:", data);
    const bringgster = await db("bringgsters").where("id", id).first();
    if (!bringgster) {
      return { error: "Bringgster not found" };
    }
    const updatedBringgster = await db("bringgsters").where("id", id).update(data).returning("*");
    if (updatedBringgster.length === 0) {
      return { error: "Bringgster not found" };
    }
    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(id));

    return {
      message: "Bringgster updated successfully",
      bringgster: updatedBringgster,
    };
  } catch (error) {
    console.error("Error updating bringgster:", error);
    return { error: "Internal server error" };
  }
}

// delete bringgster
async function deleteBringgster(id) {
  try {
    console.log("Deleting bringgster:", id);
    const deletedCount = await db("bringgsters").where("id", id).del();
    if (deletedCount === 0) {
      return { error: "Bringgster not found" };
    }
    await redisClient.del(ALL_KEY);
    await redisClient.del(ID_KEY(id));

    return {
      message: "Bringgster deleted successfully",
      bringgster: deletedCount,
    };
  } catch (error) {
    console.error("Error deleting bringgster:", error);
    return { error: "Internal server error" };
  }
}

//----------------------------- Routes -----------------------------

app.get("/bringgsters", async (req, res) => {
  try {
    const result = await fetchBringgsters();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching bringgsters:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/bringgsters/:id", async (req, res) => {
  try {
    const bringgster = await db("bringgsters").where("id", req.params.id).first();
    if (!bringgster) {
      return res.status(404).json({ error: "Bringgster not found" });
    }
    res.status(200).json(bringgster);
  } catch (error) {
    console.error("Error fetching bringgster:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//----------------------------- RabbitMQ -----------------------------

mq.subscribe("bringgsters", { durable: true, channel: { prefetch: 1 } }, async (msg: any) => {
  try {
    const type = msg?.type;
    if (type === "getAllBringgsters") {
      return await fetchBringgsters();
    } else if (type === "getBringgsterById") {
      return await fetchBringgsterById(msg?.id);
    } else if (type === "createBringgster") {
      return await createBringgster(msg?.data);
    } else if (type === "updateBringgster") {
      return await updateBringgster(msg?.id, msg?.data);
    } else if (type === "deleteBringgster") {
      return await deleteBringgster(msg?.id);
    }
  } catch (error) {
    console.error("Error fetching bringgsters (RPC):", error);
    return { error: "Internal server error" };
  }
});