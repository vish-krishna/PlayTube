import mongoose, { isValidObjectId } from 'mongoose';
import { Video } from '../models/video.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    deleteImageFromCloudinary,
    deleteVideoFromCloudinary,
    uploadFileOnCloud,
} from '../utils/cloudinary.js';
import { getFilesPath } from '../utils/filePath.js';
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    //TODO: get all videos based on query, sort, pagination

    const allVideos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, allVideos, 'videos fetched successfully'));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        throw new ApiError('Title and descriptions are required');
    }
    const videoFilePath = getFilesPath(req, 'videoFile');
    const thumbnailFilePath = getFilesPath(req, 'thumbnail');

    if (!videoFilePath || !thumbnailFilePath) {
        throw new ApiError('Video file and Thumbnails are required');
    }

    const videoFileResponse = await uploadFileOnCloud(videoFilePath);

    if (!videoFileResponse) {
        throw new ApiError('Video upload failed');
    }

    const thumbnailFileResponse = await uploadFileOnCloud(thumbnailFilePath);

    if (!thumbnailFileResponse) {
        throw new ApiError('Thumbnail upload failed');
    }

    const newVideo = await Video.create({
        title: title,
        description: description,
        owner: req.user._id,
        videoFile: videoFileResponse.secure_url,
        thumbnail: thumbnailFileResponse.secure_url,
        duration: videoFileResponse.duration,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, newVideo, 'video publish successfully'));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, 'Video not found');
    }

    return res.status(200).json(new ApiResponse(200, video));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    if (!title || !description) {
        throw new ApiError(400, 'Title and descriptions are required');
    }
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
            },
        },
        {
            new: true,
        }
    );

    if (!updateVideo) {
        throw new ApiError(404, 'Video details not found');
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedVideo,
                'Video details updated successfully'
            )
        );
});

const updateVideoThumnail = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const thumbnailLocalFilePath = req.file?.path;

    if (!thumbnailLocalFilePath) {
        throw new ApiError(400, 'Thumnail file is missing');
    }

    const existedVideo = await Video.findById(videoId);

    if (!existedVideo) {
        throw new ApiError(404, 'Video not found');
    }

    const thumnailFileResponse = await uploadFileOnCloud(
        thumbnailLocalFilePath
    );

    if (!thumnailFileResponse) {
        throw new ApiError(500, 'File upload failed');
    }

    await deleteImageFromCloudinary(existedVideo.thumbnail);

    existedVideo.thumbnail = thumnailFileResponse.secure_url;

    await existedVideo.save();

    return res
        .status(200)
        .json(
            new ApiResponse(200, existedVideo, 'Thumnail updated successfully')
        );
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const deletedVideo = await Video.findByIdAndDelete(videoId);

    if (!deletedVideo) {
        throw new ApiError(404, 'No Video Found');
    }
    // delete file from cloud
    await Promise.allSettled([
        deleteImageFromCloudinary(deletedVideo.thumbnail),
        deleteVideoFromCloudinary(deletedVideo.videoFile),
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, deletedVideo, 'Video Deleted Successfully'));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, 'Video not found');
    }

    video.isPublished = !video.isPublished;

    await video.save();

    return res
        .status(200)
        .json(new ApiResponse(200, video, 'Status toggled Successfully'));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    updateVideoThumnail,
    deleteVideo,
    togglePublishStatus,
};
