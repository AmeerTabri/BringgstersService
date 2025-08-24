import express, { Request, Response } from "express";
import arnavmq from "arnavmq";

const app = express();
const port = 8080;
 
const mq = arnavmq({ host: "amqp://localhost" });

app.use(express.json());

//----------------------------- Types -----------------------------

interface Post {
  id: number;
  title: string;
  body: string;
}

interface Album {
  id: number;
  title: string;
}

interface Bringgster {
  id?: number;
  first_name: string;
  last_name: string;
  role: string;
  posts?: Post[];
  albums?: Album[];
} 

interface RpcRequest {
  type: string;
  id?: string | number;
  data?: Partial<Bringgster>;
}

interface ApiResponse {
  message: string;
  data?: any;
  error?: string;
}

//----------------------------- Routes -----------------------------

// get all bringgsters
app.get("/bringgsters", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const reply = await mq.publish("bringgsters", { type: "getAllBringgsters" } as RpcRequest, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err: any) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// get bringgster by id
app.get("/bringgsters/:id", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const reply = await mq.publish("bringgsters", { type: "getBringgsterById", id: req.params.id } as RpcRequest, { rpc: true, timeout: 5000 });
    res.json({ message: `Reply received for id = ${req.params.id}`, data: reply });
  } catch (err: any) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// create a bringgster
app.post("/bringgsters", async (req: Request, res: Response<ApiResponse>) => {
  try {
    console.log("Creating bringgster:", req.body);
    const reply = await mq.publish("bringgsters", { type: "createBringgster", data: req.body } as RpcRequest, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err: any) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// update a bringgster
app.put("/bringgsters/:id", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const reply = await mq.publish("bringgsters", { type: "updateBringgster", id: req.params.id, data: req.body } as RpcRequest, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err: any) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

// delete a bringgster
app.delete("/bringgsters/:id", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const reply = await mq.publish("bringgsters", { type: "deleteBringgster", id: req.params.id } as RpcRequest, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err: any) {
    res.status(500).json({ message: "Error", error: err.message });
  }
});

//----------------------------- Start the server -----------------------------

app.listen(port, () => console.log(`Server running on port ${port}`));
