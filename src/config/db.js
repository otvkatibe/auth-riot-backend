import mongoose from 'mongoose';

const connectDB = async () => {
  try {
      mongoose.set("StrictQuery", true);
      await mongoose.connect(
          process.env.MONGO_DB_HOST,
          { dbName: 'test_db' }
      );
      console.log("Connected to MongoDB");
  } catch (error) {
      console.error("Error connecting to MongoDB:", error);
  }
};

export default connectDB;