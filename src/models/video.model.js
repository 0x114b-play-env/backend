import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const fileSchema = new mongoose.Schema(
  {
    public_id: {
      type: String, // cloudinary public_id
      required: true,
    },
    url: {
      type: String, // cloudinary url
      required: true,
    },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    videoFile: {
      type: fileSchema,
      required: true,
    },
    thumbnail: {
      type: fileSchema,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
