import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const owner = req.user._id;

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const userHasUnliked = await Like.findOneAndDelete({
    video: videoId,
    likedBy: owner,
  });

  let userLike = null;
  let message = null;

  if (!userHasUnliked) {
    userLike = await Like.create({
      video: videoId,
      likedBy: owner,
    });
    message = "Video liked successfully";
  } else {
    message = "Video unliked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: !!userLike }, message));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const owner = req.user._id;

  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const userHasUnliked = await Like.findOneAndDelete({
    comment: commentId,
    likedBy: owner,
  });

  let userLike = null;
  let message = null;

  if (!userHasUnliked) {
    userLike = await Like.create({
      comment: commentId,
      likedBy: owner,
    });
    message = "Comment liked successfully";
  } else {
    message = "Comment unliked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: !!userLike }, message));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const owner = req.user._id;

  if (!tweetId || !mongoose.Types.ObjectId.isValid(tweetId)) {
    throw new ApiError(400, "Invalid Tweet ID");
  }

  const userHasUnliked = await Like.findOneAndDelete({
    tweet: tweetId,
    likedBy: owner,
  });

  let userLike = null;
  let message = null;

  if (!userHasUnliked) {
    userLike = await Like.create({
      tweet: tweetId,
      likedBy: owner,
    });
    message = "Tweet liked successfully";
  } else {
    message = "Tweet unliked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: !!userLike }, message));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos of the logged in user?
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(userId),
        video: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
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
              "videoFile.url": 1,
              "thumbnail.url": 1,
              owner: 1,
              title: 1,
              duration: 1,
              views: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        video: {
          $first: "$video",
        },
      },
    },
    // Replace the full document with just the video object
    {
      $replaceRoot: { newRoot: "$video" },
    },
  ]);

  const message =
    likedVideos.length > 0
      ? "Liked videos fetched successfully"
      : "No liked videos found";

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: likedVideos.length, videos: likedVideos },
        message
      )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
