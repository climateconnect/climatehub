import React, { FC, ReactNode } from "react";
import { Theme, useMediaQuery } from "@mui/material";
import Grid from "@mui/material/Grid";
import makeStyles from "@mui/styles/makeStyles";

const useStyles = makeStyles((theme) => ({
  centerItems: {
    margin: "auto 0",
    placeItems: "center",
  },
  rightPadding: {
    paddingRight: theme.spacing(6),
  },
}));

interface ContentImageSplitViewProps {
  content: ReactNode;
  image: ReactNode;
  leftGridSizes?: {
    xs?: "auto" | number;
    md?: "auto" | number;
    lg?: "auto" | number;
  };
  rightGridSizes?: {
    xs?: "auto" | number;
    md?: "auto" | number;
    lg?: "auto" | number;
  };
  minHeight?: string;
  direction?: "row" | "row-reverse" | "column" | "column-reverse";
}

const ContentImageSplitView: FC<ContentImageSplitViewProps> = ({
  content,
  image,
  leftGridSizes,
  rightGridSizes,
  minHeight,
  direction,
}) => {
  // check the breakpoint for the right pane
  // if the breakpoint is not satisfied, the right pane will be hidden
  const rightPaneHidden = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const classes = useStyles();

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
        {...leftGridSizes}
        className={`${classes.centerItems} ${!rightPaneHidden && classes.rightPadding}`}
      >
        {content}
      </Grid>

      {/* image pane */}
      {!rightPaneHidden && (
        <Grid size={{ md: 5 }} {...rightGridSizes} style={{ display: "flex" }}>
          {image}
        </Grid>
      )}
    </Grid>
  );
};

export default ContentImageSplitView;
