import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet

  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const userId = req.user._id;
  const user = await User.findById(userId);

  const tweet = await Tweet.create({
    owner: user._id,
    content,
  });

  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating the tweet");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const {userId} = req.params;

  if (!userId) {
        throw new ApiError(400, "user id is missing");
    
  }

  const userTweets = await Tweet.find({ owner: userId });

  const message = userTweets.length
    ? "User tweets fetched successfully"
    : "No tweets found for user";

  return res.status(200).json(new ApiResponse(200, userTweets, message));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet 

  // const tweetToUpdate;

});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
