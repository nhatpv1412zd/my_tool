import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Mock Restaurant Data (Vinh Khanh Street, District 4, HCMC)
  // Coordinates are approximate for Vinh Khanh street area
  const restaurants = [
    {
      id: "1",
      name: "Ốc Oanh",
      image: "https://picsum.photos/seed/ocoanh/400/300",
      specialty: "Grilled Scallops with Quail Eggs",
      lat: 10.7612,
      lng: 106.7055,
      description: "A legendary spot on Vinh Khanh known for its bustling atmosphere and fresh seafood."
    },
    {
      id: "2",
      name: "Ốc Đào 2",
      image: "https://picsum.photos/seed/ocdao/400/300",
      specialty: "Sea Snails in Coconut Milk",
      lat: 10.7605,
      lng: 106.7048,
      description: "Famous for its rich sauces and wide variety of snail species."
    },
    {
      id: "3",
      name: "Ốc Vũ",
      image: "https://picsum.photos/seed/ocvu/400/300",
      specialty: "Salt-Toasted Crab Claws",
      lat: 10.7620,
      lng: 106.7062,
      description: "Great for large groups with a spacious seating area and quick service."
    },
    {
      id: "4",
      name: "Ốc Thảo",
      image: "https://picsum.photos/seed/octhao/400/300",
      specialty: "Steamed Clams with Lemongrass",
      lat: 10.7598,
      lng: 106.7035,
      description: "A more local feel with authentic flavors and very reasonable prices."
    },
    {
      id: "5",
      name: "Tôi",
      image: "https://picsum.photos/seed/octhao/400/300",
      specialty: "Steamed Clams with Lemongrass",
      lat: 10.7411366,
      lng: 106.6862173,
      description: "A more local feel with authentic flavors and very reasonable prices."
    }
  ];

  // API Endpoint: Get Nearby Restaurants
  app.post("/api/nearby", (req, res) => {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and Longitude are required" });
    }

    // Simple distance calculation (Mocking PostGIS ST_DWithin)
    // In a real app, you'd use a SQL query with PostGIS
    const nearby = restaurants.map(rest => {
      const distance = Math.sqrt(
        Math.pow(rest.lat - lat, 2) + Math.pow(rest.lng - lng, 2)
      ) * 111320; // Rough conversion to meters

      return { ...rest, distance: Math.round(distance) };
    }).filter(rest => rest.distance <= 3000); // Within 1km for PoC

    res.json(nearby);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
