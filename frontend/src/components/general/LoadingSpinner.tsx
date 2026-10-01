import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import React, { useContext } from "react";
import LoadingContext from "../context/LoadingContext";

type StyleProps = { $noMarginTop?: boolean; $color?: string };

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const Spinner = styled(CircularProgress, { shouldForwardProp })<StyleProps>(
  ({ $noMarginTop, $color }) => ({
    marginTop: $noMarginTop ? 0 : "48px",
    color: $color ? $color : "default",
  })
);

const MessageText = styled(Typography, { shouldForwardProp })<StyleProps>(({ theme, $color }) => ({
  marginTop: theme.spacing(2),
  textAlign: "center",
  color: $color,
}));

const ProgressAndMessageContainer = styled("div")({
  textAlign: "center",
});

type Props = {
  isLoading?: boolean;
  className?: string;
  color?: string;
  noMarginTop?: boolean;
  message?: string;
};
/**
 * Generalized loading spinner that's centered and to be used
 * for search and filtering use cases. Uses a global loading context
 * to determine if the spinnner should be rendered.
 */
const LoadingSpinner = ({ isLoading = false, className, color, noMarginTop, message }: Props) => {
  const loadingContext = useContext(LoadingContext);

  // A short-circuit isLoading prop will bypass the loading context.
  if (isLoading) {
    return (
      <Grid
        direction="column"
        container
        justifyContent="center"
        alignContent="center"
        className={className}
      >
        <ProgressAndMessageContainer>
          <Spinner $noMarginTop={noMarginTop} $color={color} />
          {message && <MessageText $color={color}>{message}</MessageText>}
        </ProgressAndMessageContainer>
      </Grid>
    );
  }
  if (!loadingContext.spinning) {
    return null;
  }

  return (
    <Grid container justifyContent="center" className={className}>
      <Spinner $noMarginTop={noMarginTop} $color={color} />
    </Grid>
  );
};

export default LoadingSpinner;
