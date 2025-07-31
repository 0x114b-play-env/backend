import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    throw new ApiError(
      400,
      "Both name and description are required to create a playlist"
    );
  }

  if (typeof name !== "string" || typeof description !== "string") {
    throw new ApiError(
      400,
      "Both name and description should be of type string"
    );
  }

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (trimmedName === "" || trimmedDescription === "") {
    throw new ApiError(400, "Both name and description cannot be empty");
  }

  const createdPlaylist = await Playlist.create({
    name: trimmedName,
    description: trimmedDescription,
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdPlaylist, "Playlist created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  //TODO: get user playlists
  const { userId } = req.params;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Valid User ID is required");
  }

  // This pipeline can be performance-heavy if users have many playlists and videos; consider adding pagination or limiting fields if performance becomes an issue.

  const userPlaylists = await Playlist.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
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
              duration: 1,
              thumbnail: 1,
              owner: 1,
              description: 1,
              views: 1,
            },
          },
        ],
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
        videoCount: {
          $size: "$videos",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  const message = userPlaylists.length
    ? "User playlists fetched successfully"
    : "No playlists found for user";

  return res.status(200).json(new ApiResponse(200, userPlaylists, message));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  //TODO: get playlist by id
  const { playlistId } = req.params;

  if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new ApiError(400, "Valid Playlist ID is required");
  }

  const userPlaylist = await Playlist.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(playlistId) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
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
        ],
      },
    },
  ]);

  if (!userPlaylist?.length) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        userPlaylist[0],
        "User playlist fetched successfully"
      )
    );
});

// For getUserPlaylists and getPlaylistById (videos array), consider adding pagination or limiting videos array size if your app scales.

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new ApiError(400, "Valid Playlist ID is required");
  }

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Valid Video ID is required");
  }

  const updateResult = await Playlist.updateOne(
    { _id: playlistId, owner: req.user._id },
    { $addToSet: { videos: videoId } }
  );

  if (updateResult.matchedCount === 0) {
    throw new ApiError(404, "Playlist not found or you are not authorized");
  }

  const isVideoAddedToPlaylist = updateResult.modifiedCount;

  const message = isVideoAddedToPlaylist
    ? "Video added successfully"
    : "Video already exists in this playlist";

  const updatedPlaylist = isVideoAddedToPlaylist
    ? await Playlist.findById(playlistId)
    : {};

  return res.status(200).json(new ApiResponse(200, updatedPlaylist, message));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  // TODO: remove video from playlist
  const { playlistId, videoId } = req.params;

  if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new ApiError(400, "Valid Playlist ID is required");
  }

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Valid Video ID is required");
  }

  const removeResult = await Playlist.updateOne(
    { _id: playlistId, owner: req.user._id },
    { $pull: { videos: videoId } }
  );

  if (removeResult.matchedCount === 0) {
    throw new ApiError(404, "Playlist not found or you are not authorized");
  }

  const isVideoRemovedFromPlaylist = removeResult.modifiedCount;

  const message = isVideoRemovedFromPlaylist
    ? "Video removed successfully"
    : "Video does not exist in this playlist";

  const updatedPlaylist = isVideoRemovedFromPlaylist
    ? await Playlist.findById(playlistId)
    : {};

  return res.status(200).json(new ApiResponse(200, updatedPlaylist, message));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  // TODO: delete playlist

  const { playlistId } = req.params;

  if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new ApiError(400, "Valid Playlist ID is required");
  }

  const deletedPlaylist = await Playlist.findOneAndDelete({
    _id: playlistId,
    owner: req.user._id,
  });

  if (!deletedPlaylist) {
    throw new ApiError(404, "Playlist not found or you are not authorized");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedPlaylist, "Playlist deleted successfully")
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  //TODO: update playlist

  if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new ApiError(400, "Valid Playlist ID is required");
  }

  if (!name && !description) {
    throw new ApiError(
      400,
      "Either name or description is required to update the playlist"
    );
  }

  const updateData = {};
  if (typeof name === "string") {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      throw new ApiError(400, "Playlist name cannot be empty");
    }
    updateData.name = trimmedName;
  }

  if (typeof description === "string") {
    const trimmedDescription = description.trim();
    if (trimmedDescription === "") {
      throw new ApiError(400, "Playlist description cannot be empty");
    }
    updateData.description = trimmedDescription;
  }

  const updatedPlaylist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id,
    },
    {
      $set: updateData,
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError(404, "Playlist not found or you are not authorized");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
