import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Tweet } from "../models/tweet.model.js";
import { Like } from "../models/like.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
  const owner = req.user._id;

  const [totalSubscribers, totalTweets, videoStatsAgg] = await Promise.all([
    Subscription.countDocuments({
      channel: owner,
    }),

    Tweet.countDocuments({
      owner,
    }),

    Video.aggregate([
      {
        $match: { owner: new mongoose.Types.ObjectId(owner) },
      },
      {
        $lookup: {
          from: "likes",
          let: { videoId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$video", "$$videoId"],
                },
              },
            },
            {
              $count: "count",
            },
          ],
          as: "likesData",
        },
      },
      {
        $lookup: {
          from: "comments",
          let: { videoId: "$_id" },
          pipeline: [
            {
              $match: {
                $exp: {
                  $eq: ["$video", "$$videoId"],
                },
              },
            },
            {
              $count: "count",
            },
          ],
          as: "commentsData",
        },
      },
      {
        $addFields: {
          likesCount: {
            $ifNull: [{ $arrayElemAt: ["$likesData.count", 0] }, 0],
          },
          commentsCount: {
            $ifNull: [{ $arrayElemAt: ["$commentsData.count", 0] }, 0],
          },
        },
      },
      {
        $project: {
          likesData: 0,
          commentsData: 0,
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          totalVideos: { $sum: 1 },
          totalLikes: { $sum: "$likesCount" },
          totalComments: { $sum: "$commentsCount" },
        },
      },
    ]),
  ]);

  const {
    totalViews = 0,
    totalVideos = 0,
    totalLikes = 0,
    totalComments = 0,
  } = videoStatsAgg.length > 0 ? videoStatsAgg[0] : {};

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalSubscribers,
        totalViews,
        totalVideos,
        totalLikes,
        totalComments,
        totalTweets,
      },
      "Channel stats fetched successfully"
    )
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
  const owner = req.user._id;

  const channelVideos = await Video.find({ owner }).select("-owner");
  // .sort({ [sortBy]: sortType === "desc" ? -1 : 1 })
  // .skip((page - 1) * limit)
  // .limit(limit);

  const message =
    channelVideos.length > 0
      ? "Channel videos fetched successfully"
      : "No videos found";

  return res.status(200).json(new ApiResponse(200, channelVideos, message));
});

export { getChannelStats, getChannelVideos };
