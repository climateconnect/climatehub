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
import { Theme } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
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

const useStyles = makeStyles<Theme, { image?: string }>((theme) => ({
  ...projectOverviewStyles(theme),
  projectTitleInput: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
    width: "100%",
  },
  largeProjectTitleInput: {
    fontSize: 32,
  },
  largeScreenImageContainer: {
    width: "50%",
  },
  imageZoneWrapper: {
    display: "block",
    width: "100%",
    position: "relative",
  },
  imageZone: (props) => ({
    cursor: "pointer",
    border: "1px dashed #000",
    width: "100%",
    paddingBottom: "56.25%",
    backgroundImage: `${props.image ? `url(${props.image})` : null}`,
    backgroundSize: "contain",
  }),
  addPhotoContainer: {
    position: "absolute",
    left: "-50%",
    top: "-50%",
    width: 170,
  },
  addPhotoWrapper: {
    position: "absolute",
    left: "calc(50% - 85px)",
    top: "calc(50% - 44px)",
  },
  photoIcon: {
    display: "block",
    marginBottom: theme.spacing(1),
    margin: "0 auto",
    cursor: "pointer",
    fontSize: 40,
  },
  imageBtn: {
    padding: "8px 32px",
  },
  locationInput: {
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  overviewHeadline: {
    fontSize: 12,
  },
  sectorField: {
    marginTop: theme.spacing(1.25),
    minWidth: "100px",
  },
}));

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
  const classes = useStyles({});
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
    <Container className={classes.projectOverview}>
      {smallScreen ? (
        <SmallScreenOverview {...passThroughProps} />
      ) : (
        <LargeScreenOverview {...passThroughProps} />
      )}
    </Container>
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
  const classes = useStyles({});
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
      <div className={classes.blockProjectInfo} ref={overviewInputsRef}>
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
      </div>
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
  const classes = useStyles({});
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
      <div className={classes.flexContainer}>
        <div className={classes.largeScreenImageContainer}>
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
        </div>
        <div className={classes.inlineProjectInfo} ref={overviewInputsRef}>
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
        </div>
      </div>
    </>
  );
}

const InputShortDescription = ({ project, handleChangeProject, texts }) => {
  const classes = useStyles({});
  return (
    <TextField
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
      className={classes.projectInfoEl}
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
  const classes = useStyles({});
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
      <ProjectLocationSearchBar
        projectData={project}
        handleSetProjectData={handleSetProject}
        className={`${classes.locationInput} ${classes.projectInfoEl}`}
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
  const classes = useStyles({});
  return (
    <div className={classes.projectInfoEl}>
      <TextField
        label={texts.website}
        variant="outlined"
        fullWidth
        value={project.website}
        className={`${classes.input} ${classes.projectInfoEl}`}
        type="text"
        onChange={(event) => handleChangeProject(event.target.value, "website")}
      />
    </div>
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
  const classes = useStyles({});

  const handleValueChange = (selectedNames) => {
    // Map selected names to sector objects
    const selectedSectors = sectorOptions.filter((sector) => selectedNames.includes(sector.name));
    handleChangeProject(selectedSectors, "sectors");
  };

  const handleSectorDelete = (sector) => {
    handleChangeProject([...(project.sectors ?? []).filter((t) => t.id !== sector.id)], "sectors");
  };
  return (
    <div className={classes.projectInfoEl}>
      <List className={classes.flexContainer}>
        {project?.sectors?.map((sector) => (
          <Chip
            key={sector.name}
            label={sector.name}
            className={classes.skill}
            onDelete={() => handleSectorDelete(sector)}
          />
        ))}
        <Grid container>
          <SelectField
            options={sectorOptions}
            className={classes.sectorField}
            multiple
            values={project.sectors?.map((s) => s.name)}
            label={<div className={classes.iconLabel}>{texts.project_categories}</div>}
            size="small"
            onChange={(event) => {
              handleValueChange(event.target.value);
            }}
          />
        </Grid>
      </List>
    </div>
  );
};

type InputNameArgs = {
  project: Project;
  screenSize?: any;
  handleChangeProject: Function;
  texts: any;
};

const InputName = ({ project, screenSize, handleChangeProject, texts }: InputNameArgs) => {
  const classes = useStyles({});
  const typeId = project.project_type?.type_id ?? "project";
  const projectTypeTexts = getProjectTypeTexts(texts);
  return (
    <TextField
      label={projectTypeTexts.name[typeId]}
      value={project.name}
      className={classes.projectTitleInput}
      inputProps={screenSize === "large" ? { className: classes.largeProjectTitleInput } : {}}
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
  const classes = useStyles(project);
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
      <label htmlFor="photo" className={classes.imageZoneWrapper}>
        <input
          type="file"
          name="photo"
          ref={inputFileRef}
          id="photo"
          style={{ display: "none" }}
          onChange={onImageChange}
          accept=".png,.jpeg,.jpg"
        />
        <div className={classes.imageZone}>
          <div className={classes.addPhotoWrapper}>
            <div className={classes.addPhotoContainer}>
              <AddAPhotoIcon className={classes.photoIcon} />
              <Button
                variant="contained"
                color="primary"
                onClick={onUploadImageClick}
                className={classes.imageBtn}
              >
                {!project.image ? texts.upload_image : texts.change_image}
              </Button>
            </div>
          </div>
        </div>
      </label>
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
