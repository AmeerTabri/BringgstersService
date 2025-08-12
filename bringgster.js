const express = require("express");
const arnavmq = require("arnavmq")({ host: "amqp://localhost" });

const app = express();
const port = 8080;

app.use(express.json());

//----------------------------- Routes -----------------------------

// get all bringgsters
app.get("/bringgsters", async (req, res) => {
  try {
    const reply = await arnavmq.publish("bringgsters", { type: "getAllBringgsters" }, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get bringgster by id
app.get("/bringgsters/:id", async (req, res) => {
  try {
    const reply = await arnavmq.publish("bringgsters", { type: "getBringgsterById", id: req.params.id }, { rpc: true, timeout: 5000 });
    res.json({ message: `Reply received for id = ${req.params.id}`, data: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create a bringgster
app.post("/bringgsters", async (req, res) => {
  try {
    console.log("Creating bringgster:", req.body);
    const reply = await arnavmq.publish("bringgsters", { type: "createBringgster", data: req.body }, { rpc: true, timeout: 5000, durable: true });
    res.json({ message: "Reply received", data: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update a bringgster
app.put("/bringgsters/:id", async (req, res) => {
  try {
    const reply = await arnavmq.publish("bringgsters", { type: "updateBringgster", id: req.params.id, data: req.body }, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete a bringgster
app.delete("/bringgsters/:id", async (req, res) => {
  try {
    const reply = await arnavmq.publish("bringgsters", { type: "deleteBringgster", id: req.params.id }, { rpc: true, timeout: 5000 });
    res.json({ message: "Reply received", data: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//----------------------------- Start the server -----------------------------

app.listen(8080, () => console.log("Server running on port 8080"));
