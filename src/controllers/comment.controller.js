import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { Video } from "../models/video.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  let limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum <= 0) limitNum = 10;

  let pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum <= 0) pageNum = 1;

  const aggregateQuery = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              _id: 1,
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
        _id: 1,
        content: 1,
        owner: 1,
      },
    },
  ]);

  const options = {
    page: pageNum,
    limit: limitNum,
    allowDiskUse: true,
  };

  const result = Comment.aggregatePaginate(aggregateQuery, options);

  const message =
    result.totalDocs > 0
      ? "Video comments fetched successfully"
      : "No comments found";

  return res.status(200).json(new ApiResponse(200, result, message));
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (typeof content !== "string" || content?.trim() === "") {
    throw new ApiError(400, "Content should be a non-empty string");
  }

  const comment = await Comment.create({
    video: videoId,
    owner: req.user._id,
    content: content.trim(),
  });

  if (!comment) {
    throw new ApiError(500, "Something went wrong while adding comment");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, comment, "Comment added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  if (typeof content !== "string" || content?.trim() === "") {
    throw new ApiError(400, "Content must be a non-empty string");
  }

  const updatedComment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      owner: req.user._id,
    },
    {
      $set: { content: content.trim() },
    },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(404, "Comment not found or you are not authorized");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const deletedComment = await Comment.findOneAndDelete({
    _id: commentId,
    owner: req.user._id,
  })
    .select("_id content video owner createdAt")
    .lean();

  if (!deletedComment) {
    throw new ApiError(404, "Comment not found or you are not authorized");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, deletedComment, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
