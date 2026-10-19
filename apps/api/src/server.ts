import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "KEMI API"
  });
});

app.listen(4000, () => {
  console.log("KEMI API running on port 4000");
});
