require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "https://blog-sphere-rafee.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pmbnx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify Token Middleware
const verifyJWT = (req, res, next) => {
  const token = req.cookies["access-token"];
  if (!token) {
    return res.status(401).send("Unauthorized access");
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send("Forbidden access");
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const database = client.db("BlogSphere");
    const blogsCollection = database.collection("blogs");
    const wishlistCollection = database.collection("wishlists");
    const commentsCollection = database.collection("comments");

    // API Endpoints
    app.get("/", (req, res) => {
      res.send("Welcome to the root directory");
    });

    // Generate JWT
    app.post("/jwt", (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // Set the token in the cookie
      res
        .cookie("access-token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Remove Cookie After Logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("access-token", {
          maxAge: 0,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // CRUD Operations for Blogs
    app.get("/blogs", async (req, res) => {
      const category = req.query.category;
      const id = req.query.id;
      const query = {};
      if (category) {
        const capitalized =
          category.charAt(0).toUpperCase() + category.slice(1);
        query.category = capitalized;
      }

      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/blogs", verifyJWT, async (req, res) => {
      const blog = req.body;
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== blog.email) {
        return res.status(403).send("Forbidden access");
      }
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    // CRUD Operation for a Single Blog
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      // Check if the id is a valid ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).send("Invalid Blog ID format");
      }
      const query = { _id: new ObjectId(id) };
      const blog = await blogsCollection.findOne(query);

      res.send(blog);
    });

    app.put("/blogs/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedBlog = req.body;
      const filter = { _id: new ObjectId(id) };
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== updatedBlog.email) {
        return res.status(403).send("Forbidden access");
      }
      const options = { upsert: true };
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

    app.delete("/blogs/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { authorEmail } = req.body;
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== authorEmail) {
        return res.status(403).send("Forbidden access");
      }
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);

      // Also remove this blog from wishlist
      const deleteFromWishlists = await wishlistCollection.deleteMany({
        blogId: id,
      });

      res.send({ result, deleteFromWishlists });
    });

    // Blogs By Specific User
    app.get("/blogs/user/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;
      if (decodedEmail !== email) {
        return res.status(403).send("Forbidden access");
      }
      const query = { email: email };
      const blogs = await blogsCollection.find(query).toArray();
      res.send(blogs);
    });

    // CRUD Operation for Wishlists
    app.get("/wishlists", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send("Forbidden access");
      }
      const query = {};
      if (email) {
        query.wishlistUserEmail = email;
      }
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/wishlists", verifyJWT, async (req, res) => {
      const wishlist = req.body;

      // Check if the right user
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== wishlist.wishlistUserEmail) {
        return res.status(403).send("Forbidden access");
      }

      // Verify if the blog already exists
      const existingWishlist = await wishlistCollection.findOne(wishlist);
      if (existingWishlist?.blogId) {
        return res.status(400).send("Post already exists");
      }
      const result = await wishlistCollection.insertOne(wishlist);
      res.send(result);
    });
    app.delete("/wishlists/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // Check if the right user
      const wishlistItem = await wishlistCollection.findOne(query);
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== wishlistItem.wishlistUserEmail) {
        return res.status(403).send("Forbidden access");
      }
      const result = await wishlistCollection.deleteOne(query);
      res.send(result);
    });

    // Get Featured Blogs
    app.get("/featured-blogs", async (req, res) => {
      const blogs = await blogsCollection
        .aggregate([
          {
            $addFields: {
              contentLength: { $strLenCP: "$postDescription" },
            },
          },
          {
            $match: {
              contentLength: { $gt: 0 },
            },
          },
          {
            $sort: { contentLength: -1 },
          },
          {
            $limit: 5,
          },
        ])
        .toArray();

      res.send(blogs);
    });

    // CRUD for Comments
    app.get("/comments/:id", async (req, res) => {
      const blogId = req.params.id;
      const query = { blogId };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/comments", verifyJWT, async (req, res) => {
      const comment = req.body;
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== comment.commentEmail) {
        return res.status(403).send("Forbidden access");
      }
      const result = await commentsCollection.insertOne(comment);
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
