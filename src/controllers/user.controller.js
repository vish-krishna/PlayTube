import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/user.model.js';
import { uploadFileOnCloud } from '../utils/cloudinary.js';
import { getFilesPath } from '../utils/filePath.js';

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
            new ApiResponse(201, 'User registered Successfullly', createdUser)
        );
});

export { registerUser };
