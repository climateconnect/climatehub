import { Theme, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import Image from "next/legacy/image";

const PRIO1_SLUG = "prio1";
const PERTH_SLUG = "perth";

const backgroundStyles = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: -10,
  overflow: "hidden",
} as const;

const shouldForwardProp = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

// background + defaultBackground
const Background = styled("div", { shouldForwardProp })<{ $hubSlug?: string }>(
  ({ theme, $hubSlug }) => ({
    ...backgroundStyles,
    backgroundColor:
      $hubSlug === PRIO1_SLUG ? theme.palette.secondary.main : theme.palette.primary.main,
  })
);

// background + prioOneDefaultBackground
const PrioOneBrowseBackground = styled("div")(({ theme }) => ({
  ...backgroundStyles,
  backgroundColor: theme.palette.secondary.main,
}));

const PrioOneAccentBackground = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.secondary.light,
}));

const prioOneAuthIconStyles = (theme: Theme) =>
  ({
    position: "absolute",
    top: "50vh",
    left: "70vw",
    width: "11rem",
    height: "11rem",

    // Hide the decorative icon on narrow viewports (<= 915px) where it
    // would otherwise overlap the auth split-view text. No MUI breakpoint
    // is defined at 915px in the project theme (defaults are sm:600,
    // md:900, lg:1200, xl:1536), so a raw media query is used here.
    "@media (max-width: 915px)": {
      display: "none",
    },

    [theme.breakpoints.up("xl")]: {
      top: "40vh",
      left: "auto",
      right: "4vw",
      width: "12rem",
      height: "12rem",
    },
  } as const);

// The same rules are applied to the wrapper div and to the Image's own element.
const PrioOneAuthIcon = styled("div")(({ theme }) => prioOneAuthIconStyles(theme));
const PrioOneAuthIconImage = styled(Image)(({ theme }) => prioOneAuthIconStyles(theme));

const SplitBackgroundContainer = styled("div")({
  position: "relative",
});

// backgroundBorderLeft + splitBackground
const SplitBackground = styled("div", { shouldForwardProp })<{ $hubSlug?: string }>(
  ({ theme, $hubSlug }) => ({
    borderLeftColor:
      $hubSlug === PRIO1_SLUG ? theme.palette.secondary.light : theme.palette.background.default,
    width: 0,
    height: 0,
    borderBottom: "85vh solid transparent",
    borderLeftWidth: `250vw`,
    borderLeftStyle: "solid",
    position: "absolute",
    top: 0,
    left: 0,
    transform: "rotate(0deg)",
  })
);

type Props = { hubUrl: string | undefined };

type BackgroundComponentProps = {
  mobileScreenSize: boolean;
  hubSlug?: string;
};

const isAuthPath = (pathname: string): boolean => {
  return (
    pathname.endsWith("/signup") ||
    pathname.endsWith("/signin") ||
    pathname.endsWith("/login") ||
    pathname.endsWith("/accountcreated")
  );
};

export function CustomBackground({ hubUrl }: Props) {
  const mobileScreenSize = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const pathname = window.location.pathname;
  const isAuthPage = isAuthPath(pathname);

  if (!hubUrl) {
    return null;
  }

  if (!isAuthPage) {
    return null;
  }

  switch (hubUrl.toLowerCase()) {
    case PRIO1_SLUG:
      return <PrioOneBackgroundAuth mobileScreenSize={mobileScreenSize} hubSlug={hubUrl} />;
    case PERTH_SLUG:
      return <PerthBackgroundAuth mobileScreenSize={mobileScreenSize} hubSlug={hubUrl} />;
    default:
      return null;
  }
}

const BackgroundSplitSection = ({ hubSlug }: { hubSlug?: string }) => {
  return (
    <SplitBackgroundContainer>
      <SplitBackground $hubSlug={hubSlug} />
    </SplitBackgroundContainer>
  );
};

function PrioOneBackgroundAuth({ mobileScreenSize, hubSlug }: BackgroundComponentProps) {
  // On mobile we still render the colored background but skip the
  // decorative split-triangle and group icon so the auth card stays clean.
  if (mobileScreenSize) {
    return <Background $hubSlug={hubSlug} />;
  }

  return (
    <Background $hubSlug={hubSlug}>
      <BackgroundSplitSection hubSlug={hubSlug} />
      <PrioOneAuthIcon>
        <PrioOneAuthIconImage
          src={"/images/custom_hubs/" + PRIO1_SLUG + "_group.svg"}
          layout="fill"
          alt="prio one group"
        />
      </PrioOneAuthIcon>
    </Background>
  );
}
function PerthBackgroundAuth({ mobileScreenSize, hubSlug }: BackgroundComponentProps) {
  // On mobile we still render the colored background but skip the
  // decorative split-triangle so the auth card stays clean.
  if (mobileScreenSize) {
    return <Background $hubSlug={hubSlug} />;
  }
  return (
    <Background $hubSlug={hubSlug}>
      <BackgroundSplitSection hubSlug={hubSlug} />
    </Background>
  );
}

export function PrioOneBackgroundBrowse({ isLoggedInUser }: { isLoggedInUser: boolean }) {
  const largeScreenSize = useMediaQuery("(max-width: 1300px)");

  return (
    <PrioOneBrowseBackground>
      {/* upper triangle (top left corner) - actually it is a trapezoid */}
      <PrioOneAccentBackground
        style={{
          width: "100%",
          height: "100%",

          // Note: clipPath is needed with the traditional way the percentages
          // are not supported:
          // boorderBottom: "100% solid blue"
          clipPath: "polygon(0% 100%, 100% 55%, 100% 0%, 0% 0%)",
        }}
      />
      {!isLoggedInUser && !largeScreenSize && (
        <div
          style={{
            position: "absolute",
            top: "25%",
            right: "0.5vw",
            width: "11rem",
            height: "11rem",
          }}
        >
          <Image
            src={"/images/custom_hubs/" + PRIO1_SLUG + "_group.svg"}
            layout="fill"
            alt="prio one group"
          />
        </div>
      )}
    </PrioOneBrowseBackground>
  );
}

export function PrioOneBackgroundBrowseIcon() {
  const largeScreenSize = useMediaQuery((theme: Theme) => theme.breakpoints.down("lg"));

  let width = 160;
  let height = 160;
  if (largeScreenSize) {
    width = 130;
    height = 130;
  }

  return (
    <Image
      src={"/images/custom_hubs/" + PRIO1_SLUG + "_group.svg"}
      width={width}
      height={height}
      alt="prio one group"
    />
  );
}
