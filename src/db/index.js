import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js';

async function connectDB() {
    try {
        const connectionString = `${process.env.MONGODB_URI}/${DB_NAME}`;
        console.log('connectionString -> ', connectionString);

        const connectionInstanse = await mongoose.connect(connectionString);
        console.log(
            'Mongodb connected !! ',
            connectionInstanse.connection.host
        );
    } catch (error) {
        console.log('Database connection failed! closing the app');
        console.log(error);
        process.exit(1);
    }
}

export { connectDB };
