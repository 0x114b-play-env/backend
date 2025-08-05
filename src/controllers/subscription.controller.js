import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid Channel ID");
  }

  const isChannelIdValid = await User.findById(channelId);

  if (!isChannelIdValid) {
    throw new ApiError(404, "Channel not found");
  }

  const userSubcribedAndDeleted = await Subscription.findOneAndDelete({
    subscriber: req.user._id,
    channel: channelId,
  })
    .select("_id subscriber channel createdAt")
    .lean();

  let message = null;
  let userSubscribed = null;
  let responseSubscription = null;

  if (!userSubcribedAndDeleted) {
    userSubscribed = await Subscription.create({
      subscriber: req.user._id,
      channel: channelId,
    });

    if (userSubscribed) {
      responseSubscription = {
        _id: userSubscribed._id,
        subscriber: userSubscribed.subscriber,
        channel: userSubscribed.channel,
        createdAt: userSubscribed.createdAt,
      };
      message = "User subscribed successfully";
    } else {
      throw new ApiError(500, "Something went wrong while subscribing");
    }
  } else {
    message = "User unsubscribed successfully";
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        subscribed: !!userSubscribed,
        subscription: responseSubscription || userSubcribedAndDeleted,
      },
      message
    )
  );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid Channel ID");
  }

  const isChannelIdValid = await User.findById(channelId);

  if (!isChannelIdValid) {
    throw new ApiError(404, "Channel not found");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: { channel: new mongoose.Types.ObjectId(channelId) },
    },
    {
      $group: {
        _id: null,
        subscribersCount: { $sum: 1 },
        subscribers: { $push: "$subscriber" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscribers", // The array of subscriber ObjectIds from group
        foreignField: "_id", // Match with user _id field
        as: "subscriberInfo", // Output joined user documents here
      },
    },
    {
      $project: {
        _id: 0,
        subscribersCount: 1,
        usernames: {
          $map: {
            input: "$subscriberInfo",
            as: "user",
            in: "$$user.username", // Extract username field from each joined user doc
          },
        },
      },
    },
  ]);

  const message = subscribers?.[0]
    ? "User channel subscribers fetched successfully"
    : "No subscribers found";

  return res
    .status(200)
    .json(new ApiResponse(200, subscribers?.[0] || {}, message));
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId || !mongoose.Types.ObjectId.isValid(subscriberId)) {
    throw new ApiError(400, "Invalid Subscriber ID");
  }

  const isSubscriberIdValid = await User.findById(subscriberId);

  if (!isSubscriberIdValid) {
    throw new ApiError(404, "Subscriber not found");
  }

  const subscribedTo = await Subscription.aggregate([
    {
      $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) },
    },
    {
      $group: {
        _id: null,
        channelCount: { $sum: 1 },
        channelNames: { $push: "$channel" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channelNames", // The array of channel ObjectIds from group
        foreignField: "_id", // Match with user _id field
        as: "channelInfo", // Output joined user documents here
      },
    },
    {
      $project: {
        _id: 0,
        channelCount: 1,
        channels: {
          $map: {
            input: "$channelInfo",
            as: "user",
            in: "$$user.username", // Extract username field from each joined user doc
          },
        },
      },
    },
  ]);

  const message = subscribedTo?.[0]
    ? "Channels subscribed by user fetched successfully"
    : "No channels found";

  return res
    .status(200)
    .json(new ApiResponse(200, subscribedTo?.[0] || {}, message));
});

// one and seven are users or subscribers

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
