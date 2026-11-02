import React, { FC, ReactNode } from "react";
import { Theme, useMediaQuery } from "@mui/material";
import Grid from "@mui/material/Grid";

interface ContentImageSplitViewProps {
  content: ReactNode;
  image: ReactNode;
  minHeight?: string;
  direction?: "row" | "row-reverse" | "column" | "column-reverse";
}

const ContentImageSplitView: FC<ContentImageSplitViewProps> = ({
  content,
  image,
  minHeight,
  direction,
}) => {
  // check the breakpoint for the right pane
  // if the breakpoint is not satisfied, the right pane will be hidden
  const rightPaneHidden = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  return (
    <Grid
      container
      spacing={2}
      style={{
        alignContent: "center",
        justifyContent: "center",
        minHeight: minHeight ? minHeight : "",
      }}
      direction={direction ? direction : "row"}
    >
      {/* content pane */}
      <Grid
        size={{ xs: 12, md: 7 }}
        sx={(theme) => ({
          margin: "auto 0",
          placeItems: "center",
          ...(!rightPaneHidden && { paddingRight: theme.spacing(6) }),
        })}
      >
        {content}
      </Grid>

      {/* image pane */}
      {!rightPaneHidden && (
        <Grid size={{ md: 5 }} style={{ display: "flex" }}>
          {image}
        </Grid>
      )}
    </Grid>
  );
};

export default ContentImageSplitView;
