import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { uploadFileOnCloudinary } from "../utils/cloudinary.js";

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
        `Invalid sortBy field: ${sortBy}. Valid fields are: ${validSortFields.join(", ")}`
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
      $project: { title: 1, description: 1, owner: 1, views: 1, createdAt: 1 },
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
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
