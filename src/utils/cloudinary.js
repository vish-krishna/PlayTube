import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

const configureCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
};

const uploadFileOnCloud = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const uploadedFileResponse = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: 'auto',
            }
        );
        console.log('File uploaded on cloudinary :- ', uploadedFileResponse);
        fs.unlinkSync(localFilePath);
        return uploadedFileResponse;
    } catch (error) {
        console.log('Failed to upload File on cloudinary :- ', error);
        fs.unlinkSync(localFilePath);
        return null;
    }
};

const deleteImageFromCloudinary = async (resourceUrl) => {
    try {
        const parts = resourceUrl.split('/');
        const fileNameWithExtension = parts[parts.length - 1];
        const fileName = fileNameWithExtension.split('.')[0];

        const deleteResponse = await cloudinary.api.delete_resources([
            fileName,
        ]);
        console.log('Deleted Response -> ', deleteResponse);

        if (
            deleteResponse &&
            deleteResponse.deleted &&
            deleteResponse.deleted[fileName] &&
            deleteResponse.deleted[fileName] === 'deleted'
        ) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.log('Image delete failed ', error);
        return false;
    }
};

const deleteVideoFromCloudinary = async (resourceUrl) => {
    try {
        const parts = resourceUrl.split('/');
        const fileNameWithExtension = parts[parts.length - 1];
        const fileName = fileNameWithExtension.split('.')[0];

        const deleteResponse = await cloudinary.api.delete_resources(
            [fileName],
            {
                resource_type: 'video',
            }
        );
        console.log('Deleted Response -> ', deleteResponse);

        if (
            deleteResponse &&
            deleteResponse.deleted &&
            deleteResponse.deleted[fileName] &&
            deleteResponse.deleted[fileName] === 'deleted'
        ) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.log('Video Delete failed ', error);
        return false;
    }
};

export {
    uploadFileOnCloud,
    configureCloudinary,
    deleteImageFromCloudinary,
    deleteVideoFromCloudinary,
};
