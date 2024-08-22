import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { uploadFileOnCloud } from '../utils/cloudinary.js';
import { getFilesPath } from '../utils/filePath.js';
import { COOKIE_OPTIONS } from '../constants.js';

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

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
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

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

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

export { registerUser, loginUser };
