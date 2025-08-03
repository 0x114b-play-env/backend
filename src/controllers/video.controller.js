import fs from "fs";
import mongoose, { isValidObjectId, set } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import {
  deleteFileFromCloudinary,
  safeFileCleanup,
  uploadFileOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  //TODO: get all videos based on query, sort, pagination

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;

  // const skip = (pageNum - 1) * limitNum;

  const matchConditions = {};

  if (query) {
    matchConditions.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    matchConditions.owner = new mongoose.Types.ObjectId(userId);
  } else if (userId) {
    throw new ApiError(400, "Invalid User ID");
  }

  const sortConditions = {};
  const validSortFields = ["views", "createdAt", "title", "duration"];

  if (sortBy) {
    if (!validSortFields.includes(sortBy)) {
      throw new ApiError(
        400,
        `Invalid sortBy field. Valid fields are: ${validSortFields.join(", ")}`
      );
    }
    const direction = sortType === "asc" ? 1 : -1;
    sortConditions[sortBy] = direction;
  } else {
    sortConditions.createdAt = -1;
  }

  const aggregateQuery = Video.aggregate([
    { $match: matchConditions },
    { $sort: sortConditions },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
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
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        owner: 1,
        views: 1,
        createdAt: 1,
        isPublished: 1,
        thumbnail: 1,
      },
    },
  ]);

  const options = {
    page: pageNum,
    limit: limitNum,
    allowDiskUse: true,
  };

  const result = await Video.aggregatePaginate(aggregateQuery, options);

  const message =
    result.totalDocs > 0 ? "Videos fetched successfully" : "No videos found";

  return res.status(200).json(new ApiResponse(200, result, message));
});

const publishAVideo = asyncHandler(async (req, res) => {
  if (!req.body || typeof req?.body !== "object") {
    throw new ApiError(400, "Request body is required");
  }

  const videoFileLocalPath = req.files?.videoFile?.[0].path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0].path;

  try {
    const { title, description } = req.body;

    if (!title || !description) {
      throw new ApiError(400, "Title and description are required.");
    }

    if (!videoFileLocalPath) {
      throw new ApiError(400, "Video file is required.");
    }

    if (!thumbnailLocalPath) {
      throw new ApiError(400, "Thumbnail image is required.");
    }

    const videoFile = await uploadFileOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadFileOnCloudinary(thumbnailLocalPath);

    if (videoFile && thumbnail) {
      safeFileCleanup(videoFileLocalPath, thumbnailLocalPath);
    } else {
      throw new ApiError(
        500,
        "Something went wrong while uploading video or thumbnail"
      );
    }

    const video = await Video.create({
      title,
      description,
      videoFile: { public_id: videoFile.public_id, url: videoFile.url },
      thumbnail: { public_id: thumbnail.public_id, url: thumbnail.url },
      duration: videoFile.duration,
      owner: req.user._id,
    });

    if (!video) {
      throw new ApiError(500, "Somethig went wrong while publishing the video");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video published successfully"));
  } catch (error) {
    if (videoFileLocalPath && fs.existsSync(videoFileLocalPath)) {
      safeFileCleanup(videoFileLocalPath);
    }
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      safeFileCleanup(thumbnailLocalPath);
    }

    throw error;
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById({ _id: videoId }).populate(
    "owner",
    "fullName username avatar"
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  if (!req.body || typeof req?.body !== "object") {
    throw new ApiError(400, "Request body is required");
  }

  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  if (!title && !description && !thumbnailLocalPath) {
    throw new ApiError(
      400,
      "At least one of title, description, or thumbnail must be provided for update."
    );
  }
  const existingVideo = await Video.findById(videoId);
  if (!existingVideo) {
    throw new ApiError(404, "Video not found");
  }

  const updateFields = {};

  if (title) {
    if (typeof title !== "string" || title.trim() === "") {
      throw new ApiError(
        400,
        "Title, if provided, must be a non-empty string."
      );
    }
    updateFields.title = title.trim();
  }

  if (description) {
    if (typeof description !== "string" || description.trim() === "") {
      throw new ApiError(
        400,
        "Description, if provided, must be a non-empty string."
      );
    }
    updateFields.description = description.trim();
  }

  if (thumbnailLocalPath) {
    const thumbnail = await uploadFileOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
      safeFileCleanup(thumbnailLocalPath);
      throw new ApiError(
        500,
        "Something went wrong while updating thumbnail file"
      );
    }

    safeFileCleanup(thumbnailLocalPath);

    if (existingVideo?.thumbnail?.public_id) {
      try {
        await deleteFileFromCloudinary(existingVideo.thumbnail.public_id);
      } catch (err) {
        console.error("Failed to delete old thumbnail from Cloudinary:", err);
      }
    }

    updateFields.thumbnail = {
      public_id: thumbnail.public_id,
      url: thumbnail.url,
    };
  }

  const updatedVideo = await Video.findOneAndUpdate(
    { _id: videoId, owner: req.user._id },
    updateFields,
    {
      new: true,
      runValidators: true,
    }
  ).populate("owner", "fullName username avatar");

  if (!updatedVideo) {
    throw new ApiError(404, "Video not found or you are not authorized");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findOneAndDelete({
    _id: videoId,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(404, "Video not found or you are not authorized");
  }

  try {
    if (video.videoFile?.public_id) {
      await deleteFileFromCloudinary(video.videoFile.public_id, "video");
    }
    if (video.thumbnail?.public_id) {
      await deleteFileFromCloudinary(video.thumbnail.public_id);
    }
  } catch (err) {
    console.error("Failed to delete files from Cloudinary:", err);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const updatedVideo = await Video.findOneAndUpdate(
    {
      _id: videoId,
      owner: req.user._id,
    },
    [{ $set: { isPublished: { $not: "$isPublished" } } }],
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(404, "Video not found or you are not authorized");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Publish status toggled successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
