import {
  Button,
  Chip,
  Container,
  FormControlLabel,
  List,
  Switch,
  TextField,
  Grid,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import React, { RefObject, useContext, useRef, useState } from "react";
import SelectField from "../general/SelectField";
// Relative imports
import {
  convertToJPGWithAspectRatio,
  getImageUrl,
  getResizedImage,
  whitenTransparentPixels,
} from "../../../public/lib/imageOperations";
import projectOverviewStyles from "../../../public/styles/projectOverviewStyles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import UploadImageDialog from "../dialogs/UploadImageDialog";
import ProjectLocationSearchBar from "../shareProject/ProjectLocationSearchBar";
import { Project, Sector } from "../../types";
import CustomHubSelection from "../project/CustomHubSelection";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

const OverviewContainer = styled(Container)(
  ({ theme }) => projectOverviewStyles(theme).projectOverview
);

const BlockProjectInfo = styled("div")(
  ({ theme }) => projectOverviewStyles(theme).blockProjectInfo
);

const FlexContainer = styled("div")(({ theme }) => projectOverviewStyles(theme).flexContainer);

const InlineProjectInfo = styled("div")(
  ({ theme }) => projectOverviewStyles(theme).inlineProjectInfo
);

const LargeScreenImageContainer = styled("div")({
  width: "50%",
});

const ShortDescriptionField = styled(TextField)(
  ({ theme }) => projectOverviewStyles(theme).projectInfoEl
);

const ProjectInfoEl = styled("div")(({ theme }) => projectOverviewStyles(theme).projectInfoEl);

// projectInfoEl first, then locationInput: the later rule wins (marginTop)
const LocationSearchBar = styled(ProjectLocationSearchBar)(({ theme }) => ({
  ...projectOverviewStyles(theme).projectInfoEl,
  marginBottom: theme.spacing(1),
  marginTop: theme.spacing(2),
}));

const WebsiteField = styled(TextField)(({ theme }) => projectOverviewStyles(theme).projectInfoEl);

const SectorList = styled(List)(({ theme }) => projectOverviewStyles(theme).flexContainer);

const SkillChip = styled(Chip)(({ theme }) => projectOverviewStyles(theme).skill);

const SectorSelectField = styled(SelectField)(({ theme }) => ({
  marginTop: theme.spacing(1.25),
  minWidth: "100px",
}));

const TitleInput = styled(TextField, {
  shouldForwardProp: (prop) => prop !== "$largeInput",
})<{ $largeInput?: boolean }>(({ theme, $largeInput }) => ({
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(2),
  width: "100%",
  ...($largeInput ? { "& .MuiInputBase-input": { fontSize: 32 } } : {}),
}));

const ImageZoneWrapper = styled("label")({
  display: "block",
  width: "100%",
  position: "relative",
});

const ImageZone = styled("div")({
  cursor: "pointer",
  border: "1px dashed #000",
  width: "100%",
  paddingBottom: "56.25%",
  backgroundSize: "contain",
});

const AddPhotoContainer = styled("div")({
  position: "absolute",
  left: "-50%",
  top: "-50%",
  width: 170,
});

const AddPhotoWrapper = styled("div")({
  position: "absolute",
  left: "calc(50% - 85px)",
  top: "calc(50% - 44px)",
});

const PhotoIcon = styled(AddAPhotoIcon)(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing(1),
  margin: "0 auto",
  cursor: "pointer",
  fontSize: 40,
}));

const ImageButton = styled(Button)({
  padding: "8px 32px",
});

type Args = {
  project: Project;
  // eslint-disable-next-line no-unused-vars
  handleSetProject: (project: Project) => void;
  smallScreen: boolean;
  overviewInputsRef: any;
  locationOptionsOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  handleSetLocationOptionsOpen: (open: boolean) => void;
  locationInputRef: any;
  sectorOptions: Sector[];
};

//TODO: Allow changing project type?!

export default function EditProjectOverview({
  project,
  handleSetProject,
  smallScreen,
  overviewInputsRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  locationInputRef,
  sectorOptions,
}: Args) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  // Lift image dialog state to parent component
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [tempImage, setTempImage] = useState(project.image ? getImageUrl(project.image) : null);
  const [isImgLoading, setIsImgLoading] = useState(false);

  const handleChangeProject = (newValue, key) => {
    handleSetProject({ ...project, [key]: newValue });
  };
  const handleChangeImage = (newImage, newThumbnailImage) => {
    handleSetProject({
      ...project,
      image: newImage,
      thumbnail_image: newThumbnailImage,
    });
  };
  const passThroughProps = {
    project: project,
    handleChangeProject: handleChangeProject,
    handleChangeImage: handleChangeImage,
    overviewInputsRef: overviewInputsRef,
    handleSetProject: handleSetProject,
    handleSetLocationOptionsOpen: handleSetLocationOptionsOpen,
    locationOptionsOpen: locationOptionsOpen,
    locationInputRef: locationInputRef,
    texts: texts,
    sectorOptions: sectorOptions,
    // Add image dialog props
    imageDialogOpen: imageDialogOpen,
    setImageDialogOpen: setImageDialogOpen,
    tempImage: tempImage,
    setTempImage: setTempImage,
    isImgLoading: isImgLoading,
    setIsImgLoading: setIsImgLoading,
  };

  return (
    <OverviewContainer disableGutters>
      {smallScreen ? (
        <SmallScreenOverview {...passThroughProps} />
      ) : (
        <LargeScreenOverview {...passThroughProps} />
      )}
    </OverviewContainer>
  );
}

type ScreenOverviewProps = {
  project: Project;
  /* eslint-disable no-unused-vars */
  handleChangeProject: (newValue: any, key: string) => void;
  handleChangeImage: (newImage: any, newThumbnailImage: any) => void;
  handleSetProject: (project: Project) => void;
  handleSetLocationOptionsOpen: (open: boolean) => void;
  /* eslint-disable no-unused-vars */
  overviewInputsRef: RefObject<HTMLInputElement>;
  locationInputRef: RefObject<HTMLInputElement>;
  locationOptionsOpen: boolean;
  texts: Record<string, string>;
  sectorOptions: Sector[];
  // Add image dialog props
  imageDialogOpen: boolean;
  setImageDialogOpen: (open: boolean) => void;
  tempImage: string | null;
  setTempImage: (image: string | null) => void;
  isImgLoading: boolean;
  setIsImgLoading: (loading: boolean) => void;
};

function SmallScreenOverview({
  project,
  handleChangeProject,
  handleChangeImage,
  overviewInputsRef,
  handleSetProject,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  texts,
  sectorOptions,
  imageDialogOpen,
  setImageDialogOpen,
  tempImage,
  setTempImage,
  isImgLoading,
  setIsImgLoading,
}: ScreenOverviewProps) {
  return (
    <>
      <InputImage
        project={project}
        screenSize="small"
        handleChangeImage={handleChangeImage}
        texts={texts}
        imageDialogOpen={imageDialogOpen}
        setImageDialogOpen={setImageDialogOpen}
        tempImage={tempImage}
        setTempImage={setTempImage}
        isImgLoading={isImgLoading}
        setIsImgLoading={setIsImgLoading}
      />
      <BlockProjectInfo ref={overviewInputsRef}>
        <InputName
          project={project}
          screenSize="small"
          texts={texts}
          handleChangeProject={handleChangeProject}
        />
        <InputShortDescription
          project={project}
          handleChangeProject={handleChangeProject}
          texts={texts}
        />
        <InputLocation
          project={project}
          handleChangeProject={handleChangeProject}
          handleSetProject={handleSetProject}
          texts={texts}
          locationInputRef={locationInputRef}
          locationOptionsOpen={locationOptionsOpen}
          handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
        />
        <InputWebsite project={project} handleChangeProject={handleChangeProject} texts={texts} />
        <InputSectors
          project={project}
          handleChangeProject={handleChangeProject}
          texts={texts}
          sectorOptions={sectorOptions}
        />
      </BlockProjectInfo>
    </>
  );
}

function LargeScreenOverview({
  project,
  handleChangeProject,
  handleChangeImage,
  handleSetProject,
  overviewInputsRef,
  texts,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  sectorOptions,
  imageDialogOpen,
  setImageDialogOpen,
  tempImage,
  setTempImage,
  isImgLoading,
  setIsImgLoading,
}: ScreenOverviewProps) {
  function handleUpdateSelectedHub(hubUrl: string) {
    handleSetProject({
      ...project,
      hubUrl: hubUrl,
    });
  }

  return (
    <>
      <InputName
        project={project}
        screenSize="large"
        handleChangeProject={handleChangeProject}
        texts={texts}
      />
      <FlexContainer>
        <LargeScreenImageContainer>
          <InputImage
            project={project}
            screenSize="large"
            handleChangeImage={handleChangeImage}
            texts={texts}
            imageDialogOpen={imageDialogOpen}
            setImageDialogOpen={setImageDialogOpen}
            tempImage={tempImage}
            setTempImage={setTempImage}
            isImgLoading={isImgLoading}
            setIsImgLoading={setIsImgLoading}
          />
        </LargeScreenImageContainer>
        <InlineProjectInfo ref={overviewInputsRef}>
          <InputShortDescription
            project={project}
            handleChangeProject={handleChangeProject}
            texts={texts}
          />
          <InputLocation
            project={project}
            handleChangeProject={handleChangeProject}
            handleSetProject={handleSetProject}
            texts={texts}
            locationInputRef={locationInputRef}
            locationOptionsOpen={locationOptionsOpen}
            handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
          />
          <InputWebsite project={project} handleChangeProject={handleChangeProject} texts={texts} />
          <InputSectors
            project={project}
            handleChangeProject={handleChangeProject}
            texts={texts}
            sectorOptions={sectorOptions}
          />
          <CustomHubSelection
            currentHubName={project.hubUrl ?? ""}
            handleUpdateSelectedHub={handleUpdateSelectedHub}
            typeId={project.project_type.type_id}
          />
        </InlineProjectInfo>
      </FlexContainer>
    </>
  );
}

const InputShortDescription = ({ project, handleChangeProject, texts }) => {
  return (
    <ShortDescriptionField
      label={texts["summarize_your_" + project.project_type.type_id]}
      variant="outlined"
      multiline
      fullWidth
      value={project.short_description}
      type="text"
      minRows={4}
      onChange={(event) =>
        handleChangeProject(event.target.value.substring(0, 280), "short_description")
      }
      required
      placeholder={texts.briefly_summarise_what_you_are_doing_please_only_use_english}
    />
  );
};

const InputLocation = ({
  project,
  handleChangeProject,
  handleSetProject,
  texts,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
}) => {
  const handleChangeLocation = (newLocation) => {
    handleChangeProject(newLocation, "loc");
  };
  return (
    <div /*TODO(undefined) className={classes.projectInfoEl}*/>
      <FormControlLabel
        control={
          <Switch
            checked={project.is_online ?? false}
            onChange={(e) => handleChangeProject(e.target.checked, "is_online")}
            color="primary"
          />
        }
        label={texts.online}
      />
      {/*<LocationSearchBar
        label={texts.location}
        required
        className={classes.locationInput}
        value={project.loc}
        onChange={(value) => {
          handleChangeProject(value, "loc");
        }}
        onSelect={handleChangeLocation}
        open={locationOptionsOpen}
        handleSetOpen={handleSetLocationOptionsOpen}
        locationInputRef={locationInputRef}
      />*/}
      <LocationSearchBar
        projectData={project}
        handleSetProjectData={handleSetProject}
        hideHelperText
        locationInputRef={locationInputRef}
        locationOptionsOpen={locationOptionsOpen}
        handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
        onChangeLocation={handleChangeLocation}
      />
    </div>
  );
};

const InputWebsite = ({ project, handleChangeProject, texts }) => {
  return (
    <ProjectInfoEl>
      <WebsiteField
        label={texts.website}
        variant="outlined"
        fullWidth
        value={project.website}
        type="text"
        onChange={(event) => handleChangeProject(event.target.value, "website")}
      />
    </ProjectInfoEl>
  );
};

type InputSectorsProps = {
  project: Project;
  handleChangeProject: (newValue: any, key: string) => void;
  texts: Record<string, string>;
  sectorOptions: Sector[];
};

const InputSectors = ({
  project,
  handleChangeProject,
  texts,
  sectorOptions,
}: InputSectorsProps) => {
  const handleValueChange = (selectedNames) => {
    // Map selected names to sector objects
    const selectedSectors = sectorOptions.filter((sector) => selectedNames.includes(sector.name));
    handleChangeProject(selectedSectors, "sectors");
  };

  const handleSectorDelete = (sector) => {
    handleChangeProject([...(project.sectors ?? []).filter((t) => t.id !== sector.id)], "sectors");
  };
  return (
    <ProjectInfoEl>
      <SectorList>
        {project?.sectors?.map((sector) => (
          <SkillChip
            key={sector.name}
            label={sector.name}
            onDelete={() => handleSectorDelete(sector)}
          />
        ))}
        <Grid container>
          <SectorSelectField
            options={sectorOptions}
            multiple
            values={project.sectors?.map((s) => s.name)}
            label={<div>{texts.project_categories}</div>}
            size="small"
            onChange={(event) => {
              handleValueChange(event.target.value);
            }}
          />
        </Grid>
      </SectorList>
    </ProjectInfoEl>
  );
};

type InputNameArgs = {
  project: Project;
  screenSize?: any;
  handleChangeProject: Function;
  texts: any;
};

const InputName = ({ project, screenSize, handleChangeProject, texts }: InputNameArgs) => {
  const typeId = project.project_type?.type_id ?? "project";
  const projectTypeTexts = getProjectTypeTexts(texts);
  return (
    <TitleInput
      label={projectTypeTexts.name[typeId]}
      value={project.name}
      $largeInput={screenSize === "large"}
      type="text"
      onChange={(event) => handleChangeProject(event.target.value, "name")}
      required
    />
  );
};

const InputImage = ({
  project,
  screenSize,
  handleChangeImage,
  texts,
  imageDialogOpen,
  setImageDialogOpen,
  tempImage,
  setTempImage,
  isImgLoading,
  setIsImgLoading,
}) => {
  const inputFileRef = useRef(null as HTMLInputElement | null);

  const onImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      alert(texts.please_upload_either_a_png_or_a_jpg_file);
      return;
    }
    try {
      setIsImgLoading(true);
      setImageDialogOpen(true);
      const image = await convertToJPGWithAspectRatio(file);
      setTempImage(image);
    } catch (error) {
      console.log(error);
    } finally {
      setIsImgLoading(false);
    }
  };

  const onUploadImageClick = (event) => {
    event.preventDefault();
    inputFileRef.current!.click();
  };

  const handleImageDialogClose = async (image) => {
    setImageDialogOpen(false);
    if (image && image instanceof HTMLCanvasElement) {
      whitenTransparentPixels(image);
      image.toBlob(async function (blob) {
        const resizedBlob = URL.createObjectURL(blob!);
        const thumbnailBlob = await getResizedImage(
          URL.createObjectURL(blob!),
          290,
          160,
          "image/jpeg"
        );
        handleChangeImage(resizedBlob, thumbnailBlob);
      }, "image/jpeg");
    }
  };

  return (
    <>
      <ImageZoneWrapper htmlFor="photo">
        <input
          type="file"
          name="photo"
          ref={inputFileRef}
          id="photo"
          style={{ display: "none" }}
          onChange={onImageChange}
          accept=".png,.jpeg,.jpg"
        />
        <ImageZone style={project.image ? { backgroundImage: `url(${project.image})` } : undefined}>
          <AddPhotoWrapper>
            <AddPhotoContainer>
              <PhotoIcon />
              <ImageButton variant="contained" color="primary" onClick={onUploadImageClick}>
                {!project.image ? texts.upload_image : texts.change_image}
              </ImageButton>
            </AddPhotoContainer>
          </AddPhotoWrapper>
        </ImageZone>
      </ImageZoneWrapper>
      <UploadImageDialog
        onClose={handleImageDialogClose}
        open={imageDialogOpen}
        imageUrl={tempImage}
        borderRadius={0}
        height={screenSize === "small" ? 200 : 300}
        ratio={16 / 9}
        loading={isImgLoading}
        loadingText={texts.processing_image_please_wait}
        PaperProps={{
          sx: {
            maxHeight: "none",
          },
        }}
      />
    </>
  );
};
