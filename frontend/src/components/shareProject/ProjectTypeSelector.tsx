import { Card, Radio, RadioGroup, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { styled } from "@mui/material/styles";
import React from "react";

const Box = styled(Card, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active?: boolean }>(({ theme, $active }) => ({
  borderRadius: 3,
  margin: theme.spacing(1),
  boxShadow: "3px 3px 8px #E0E0E0",
  cursor: "pointer",
  display: "flex",
  color: theme.palette.secondary.main,
  alignItems: "center",
  position: "relative",
  ...($active && {
    backgroundColor: "#d7f1ef",
    border: `1px solid ${theme.palette.primary.main}`,
  }),
}));

const TextBox = styled("div")(({ theme }) => ({
  width: 225,
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  marginRight: theme.spacing(4),
}));

const Headline = styled(Typography)({
  fontWeight: "bold",
});

const HelpText = styled(Typography)({
  fontSize: 14,
});

const ImageContainer = styled("div")(({ theme }) => ({
  width: 60,
  margin: theme.spacing(2),
  display: "flex",
  alignItems: "stretch",
  height: "100%",
}));

const Image = styled("img")({
  height: "100%",
  width: "100%",
});

const RadioButton = styled(Radio)({
  position: "absolute",
  right: 0,
  top: 0,
});

const ProjectTypeBox = ({ type, value, onChange, color }) => {
  const handleChangeValue = () => {
    onChange(type.type_id);
  };
  return (
    <Box variant="outlined" $active={value === type.type_id} onClick={handleChangeValue}>
      <ImageContainer>
        <Image src={`/images/project_types/${type.type_id}.png`} alt={type.name} />
      </ImageContainer>
      <TextBox>
        <Headline>{type.name}</Headline>
        <HelpText>{type.help_text}</HelpText>
      </TextBox>
      <RadioButton
        checked={value.type_id === type.type_id}
        onChange={handleChangeValue}
        name={type.name}
        value={type.type_id}
        color={color ? color : "primary"}
      />
    </Box>
  );
};

export default function ProjectTypeSelector({ className, value, types, onChange, color }) {
  return (
    <div className={className}>
      <RadioGroup>
        <Grid
          container
          component="ul"
          spacing={2}
          sx={{ margin: 0, padding: 0, listStyleType: "none", width: "100%" }}
        >
          {types.map((type) => (
            <Grid size={{ xs: 12, sm: 6, md: 6, lg: 6 }} component="li" key={type.type_id}>
              <ProjectTypeBox type={type} value={value} onChange={onChange} color={color} />
            </Grid>
          ))}
        </Grid>
      </RadioGroup>
    </div>
  );
}
