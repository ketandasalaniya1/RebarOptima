const mongoose = require('mongoose');

const uri = "mongodb+srv://ketandasalaniya1_db_user:d4dCGKiO3GFoCi06@cluster0.aghjxtj.mongodb.net/";

const BlockWingSchema = new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true }
}, { timestamps: true });

async function run() {
  await mongoose.connect(uri);
  // Ensure we are using test
  // mongoose defaults to test if no DB name is in URI.
  
  const BlockModel = mongoose.models.BlockWing || mongoose.model('BlockWing', BlockWingSchema);
  
  console.log("Raw query:", await mongoose.connection.db.collection('blockwings').find({ project_id: new mongoose.Types.ObjectId("6aa15773c9718a3ecea232d0") }).toArray());
  
  const result = await BlockModel.find({ project_id: new mongoose.Types.ObjectId("6aa15773c9718a3ecea232d0") });
  console.log("Mongoose query result length:", result.length);
  console.log(result);

  await mongoose.disconnect();
}

run().catch(console.error);
