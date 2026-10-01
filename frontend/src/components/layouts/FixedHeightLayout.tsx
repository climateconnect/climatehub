import { styled } from "@mui/material/styles";
import Alert from "@mui/material/Alert";
import React, { useEffect, useState } from "react";
import { getParams } from "../../../public/lib/generalOperations";
import { getMessageFromUrl } from "../../../public/lib/parsingOperations";
import theme from "../../themes/theme";
import Footer from "../footer/Footer";
import Header from "../header/Header";
import LayoutWrapper from "./LayoutWrapper";
import { useRouter } from "next/router";

const Root = styled("div")({
  margin: 0,
  height: "calc(100vh)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
});

const NoFlexHeader = styled(Header)({
  flex: "none",
});

const NoFlexFooter = styled(Footer)({
  flex: "none",
});

export default function FixedHeightLayout({ children, message, messageType, title }) {
  const [initialMessageType, setInitialMessageType] = useState(null);
  const [alertOpen, setAlertOpen] = useState(true);
  const [initialMessage, setInitialMessage] = useState("");
  const router = useRouter();
  const hubUrl = typeof router.query.hub === "string" ? router.query.hub : null;

  useEffect(() => {
    const params = getParams(window.location.href);
    if (params.message) {
      setInitialMessage(decodeURI(params.message));
    }
    if (params.errorMessage) {
      setInitialMessage(decodeURI(params.errorMessage));
      setInitialMessageType("error");
    }
  }, []);
  return (
    <LayoutWrapper theme={theme} title={title} fixedHeight>
      <Root>
        <NoFlexHeader noSpacingBottom hubUrl={hubUrl} />
        {(message || initialMessage) && alertOpen && (
          <Alert
            severity={
              messageType ? messageType : initialMessageType ? initialMessageType : "success"
            }
            onClose={() => {
              if (message) {
                setAlertOpen(false);
              } else {
                setInitialMessage(null);
              }
            }}
          >
            {getMessageFromUrl(message ? message : initialMessage)}
          </Alert>
        )}
        {children}
        <NoFlexFooter noSpacingTop noAbsolutePosition />
      </Root>
    </LayoutWrapper>
  );
}
