import { CircularProgress } from "@mui/material";
import React from "react";

export default function ButtonLoader() {
  return <CircularProgress sx={{ color: "white" }} size={23} />;
}
