import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { uploadFileOnCloud } from '../utils/cloudinary.js';
import { getFilesPath } from '../utils/filePath.js';
import { COOKIE_OPTIONS } from '../constants.js';
import mongoose from 'mongoose';

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullName, password } = req.body;

    if (
        [username, email, fullName, password].some(
            (filed) => !filed || filed?.trim() === ''
        )
    ) {
        throw new ApiError(400, 'Required fileds are missing');
    }

    const avatarLocalPath = getFilesPath(req, 'avatar');

    if (!avatarLocalPath) {
        throw new ApiError(400, 'Avatar is required');
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, 'User already registered');
    }

    const coverImageLocalPath = getFilesPath(req, 'coverImage');
    const avatarResponse = await uploadFileOnCloud(avatarLocalPath);

    if (!avatarResponse || !avatarResponse.url) {
        throw new ApiError(400, 'Avatar upload failed!');
    }

    let coverImage = null;
    if (coverImageLocalPath) {
        const coverImageResponse = await uploadFileOnCloud(coverImageLocalPath);
        if (coverImageResponse && coverImageResponse.url) {
            coverImage = coverImageResponse.url;
        }
    }

    const user = await User.create({
        fullName,
        avatar: avatarResponse.url,
        coverImage: coverImage,
        email,
        password,
        username: username.toLowerCase().trim(),
    });

    const createdUser = await User.findById(user._id).select(
        '-password -refreshToken'
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            'Something went wrong while registering the user'
        );
    }
    return res
        .status(201)
        .json(
            new ApiResponse(201, createdUser, 'User registered Successfullly')
        );
});

/**Function to generate an access token and a refresh token.
The access token is used for short-term authentication, 
while the refresh token is stored in the database for generating new access tokens when needed.*/
const generateAccessAndRefreshTokens = async (user) => {
    try {
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (_) {
        throw new ApiError(
            500,
            'Something went wrong while generating access and refresh tokens'
        );
    }
};

const generateAccessToken = (user) => {
    try {
        const accessToken = user.generateAccessToken();
        return { accessToken };
    } catch (_) {
        throw new ApiError(
            500,
            'Something went wrong while regenerating access token'
        );
    }
};

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (
        (!username || username.trim() === '') &&
        (!email || email.trim() === '')
    ) {
        throw new ApiError(400, 'Username or email is required');
    }

    if (!password || password.trim() === '') {
        throw new ApiError(400, 'Password is required');
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, 'User does not exist');
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new ApiError(404, 'Invalid user credentials!');
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user);

    const loggedInUser = {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        coverImage: user.coverImage,
        watchHistory: user.watchHistory,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        __v: user.__v,
        refreshToken: undefined,
        password: undefined,
    };
    return res
        .status(200)
        .cookie('accessToken', accessToken, COOKIE_OPTIONS)
        .cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                'User logged in successfully!'
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    return res
        .status(200)
        .clearCookie('accessToken', COOKIE_OPTIONS)
        .clearCookie('refreshToken', COOKIE_OPTIONS)
        .json(new ApiResponse(200, {}, 'User logged out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const { _id, refreshToken } = req.user;
    const user = await User.findById(_id);

    if (!user || !user.refreshToken) {
        throw new ApiError(401, 'Invalid Refresh Token.');
    }

    if (user.refreshToken !== req.user.refreshToken) {
        throw new ApiError(401, 'Refresh Token expired or used');
    }

    const { accessToken } = generateAccessToken(user);

    return res
        .status(200)
        .cookie('accessToken', accessToken, COOKIE_OPTIONS)
        .cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken,
                },
                'Token Refreshed Successfully!'
            )
        );
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (
        !oldPassword ||
        !newPassword ||
        oldPassword.trim() === '' ||
        newPassword.trim() === ''
    ) {
        throw new ApiError(400, 'Old and new password are required');
    }

    const trimmedOldPassword = oldPassword.trim();
    const trimmedNewPassword = newPassword.trim();

    if (trimmedOldPassword === trimmedNewPassword) {
        throw new ApiError(400, 'Old and new password should not be the same');
    }

    const user = await User.findById(req.user._id);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const isPasswordValid = user.isPasswordCorrect(trimmedOldPassword);

    if (!isPasswordValid) {
        throw new ApiError(400, 'Old password is incorrect');
    }

    user.password = trimmedNewPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, 'Password has changed successfully'));
});
const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
        '-password -refreshToken'
    );

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, 'User fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, es) => {
    // we are only changing email and fullName

    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(400, 'All fields are required');
    }

    const user = User.findByIdAndUpdate(
        user._id,
        {
            $set: {
                email,
                fullName,
            },
        },
        { new: true }
    ).select('-password -refreshToken');

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, 'Account details updated successfully')
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const localFilePath = req.file?.path;
    if (!localFilePath) {
        throw new ApiError(400, 'Avatar image is required');
    }

    //TODO: delete old image on cloudinary

    const avatar = await uploadFileOnCloud(localFilePath);

    if (!avatar) {
        throw new ApiError(400, 'Error while uploading the avatar');
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select('-password -refreshToken');

    return res
        .status(200)
        .json(new ApiResponse(200, user, 'Avatar image updated successfully'));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const localFilePath = req.file?.path;
    if (!localFilePath) {
        throw new ApiError(400, 'Cover image is required');
    }

    //TODO: delete old image on cloudinary

    const coverImage = await uploadFileOnCloud(localFilePath);

    if (!coverImage) {
        throw new ApiError(400, 'Error while uploading the coverImage');
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select('-password -refreshToken');

    return res
        .status(200)
        .json(new ApiResponse(200, user, 'Cover Image updated successfully'));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username || !username.trim()) {
        throw new ApiError(400, 'user name is missing');
    }

    const sanitizedUsername = username.trim().toLowerCase();

    const channel = User.aggregate([
        {
            $match: {
                username: sanitizedUsername,
            },
        },
        {
            $lookup: {
                from: 'subscriptions',
                localField: '_id',
                foreignField: 'channel',
                as: 'subscribers',
            },
        },
        {
            $lookup: {
                from: 'subscriptions',
                localField: '_id',
                foreignField: 'subscriber',
                as: 'subscribedTo',
            },
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: '$subscribers',
                },
                channelsSubscribedToCount: {
                    $size: '$subscribedTo',
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, '$subscribers.subscriber'] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, 'channel does not exists');
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                'User channel fetched successfully'
            )
        );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: 'videos',
                localField: 'watchHistory',
                foreignField: '_id',
                as: 'watchHistory',
                pipeline: [
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'owner',
                            foreignField: '_id',
                            as: 'owner',
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: '$owner',
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                'Watch history fetched successfully'
            )
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory,
};
