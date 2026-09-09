const mongoose = require('mongoose');

const uri = "mongodb+srv://ketandasalaniya1_db_user:d4dCGKiO3GFoCi06@cluster0.aghjxtj.mongodb.net/";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.useDb('test'); 
  
  const projects = await mongoose.connection.db.collection('projects').find({}).toArray();
  if (projects.length > 0) {
    console.log("Type of project _id:", typeof projects[0]._id, projects[0]._id.constructor.name);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
