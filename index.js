require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pmbnx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const database = client.db("BlogSphere");
    const blogsCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlists");

    // API Endpoints
    app.get("/", (req, res) => {
      res.send("Welcome to the root directory");
    });

    // CRUD Operations for Blogs
    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.post("/blogs", async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    // CRUD Operation for a Single Blog
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const blog = await blogsCollection.findOne(query);
      res.send(blog);
    });

    app.put("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBlog = req.body;
      const updateDoc = {
        $set: {
          postCover: updatedBlog.postCover,
          postTitle: updatedBlog.postTitle,
          postDescription: updatedBlog.postDescription,
          category: updatedBlog.category,
          publishingDate: updatedBlog.publishingDate,
        },
      };
      const result = await blogsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.delete("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    // Blogs By Specific User
    app.get("/blogs/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const blogs = await blogsCollection.find(query).toArray();
      res.send(blogs);
    });
    // CRUD Operation for Wishlists
    app.get("/wishlists/:email", async (req, res) => {
      const email = req.params.email;
      const result = await wishlistCollection.find({ email }).toArray();
      res.send(result);
    });
    app.post("/wishlists", async (req, res) => {
      const wishlist = req.body;
      // Verify if the blog already exists
      const existingWishlist = await wishlistCollection.findOne(wishlist);
      if (existingWishlist?.blogId) {
        return res.status(400).send("Post already exists");
      }
      const result = await wishlistCollection.insertOne(wishlist);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`The server is running on port ${port}`);
});
