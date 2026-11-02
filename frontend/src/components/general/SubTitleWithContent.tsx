import { styled } from "@mui/material/styles";

const SubtitleWithIcon = styled("div")({
  display: "flex",
  alignItems: "center",
  fontWeight: 700,
  minWidth: 200,
  fontSize: 15,
});

const Subtitle = styled("div")({
  fontWeight: "bold",
});

const Content = styled("div")(({ theme }) => ({
  paddingBottom: theme.spacing(2),
  // color: `${theme.palette.secondary.main}`,
  fontSize: 16,
  wordBreak: "break-word",
}));

const MarginRight = styled("div")(({ theme }) => ({
  marginRight: theme.spacing(0.5),
}));

const IconAndTitleWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(0.5),
}));

export default function SubTitleWithContent({
  subTitleIcon,
  subtitle,
  content,
}: {
  subTitleIcon?: { icon: any };
  subtitle: string;
  content: string;
}) {
  const SubtitleWrapper = subTitleIcon ? SubtitleWithIcon : Subtitle;
  return (
    <>
      <SubtitleWrapper>
        {subTitleIcon?.icon ? (
          <IconAndTitleWrapper>
            <subTitleIcon.icon />
            <MarginRight />
            {subtitle}
          </IconAndTitleWrapper>
        ) : (
          <>{subtitle}</>
        )}
      </SubtitleWrapper>
      <Content>{content}</Content>
    </>
  );
}
