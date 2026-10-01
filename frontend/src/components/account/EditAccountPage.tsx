import { Button, Checkbox, Chip, Container, Link, TextField, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import ControlPointIcon from "@mui/icons-material/ControlPoint";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Alert from "@mui/material/Alert";
import React, { Fragment, useContext, useRef, useState } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import {
  convertToJPGWithAspectRatio,
  whitenTransparentPixels,
} from "../../../public/lib/imageOperations";
import { parseLocation } from "../../../public/lib/locationOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import MultiLevelSelectDialog from "../dialogs/MultiLevelSelectDialog";
import ButtonLoader from "../general/ButtonLoader";
import ActiveSectorsSelector from "../hub/ActiveSectorsSelector";
import MiniOrganizationPreview from "../organization/MiniOrganizationPreview";
import AutoCompleteSearchBar from "../search/AutoCompleteSearchBar";
import LocationSearchBar from "../search/LocationSearchBar";
import ConfirmDialog from "./../dialogs/ConfirmDialog";
import SelectDialog from "./../dialogs/SelectDialog";
import UploadImageDialog from "./../dialogs/UploadImageDialog";
import DetailledDescriptionInput from "./DetailledDescriptionInput";
import SelectField from "../general/SelectField";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";
import { AvatarImage, UserAvatar } from "./UserAvatar";
import CloseIcon from "@mui/icons-material/Close";
const DEFAULT_BACKGROUND_IMAGE = "/images/background1.jpg";

const BackgroundContainer = styled("div", {
  shouldForwardProp: (prop) => typeof prop === "string" && !prop.startsWith("$"),
})<{ $hasImage: boolean }>(({ $hasImage }) => ({
  width: "100%",
  height: 305,
  position: "relative",
  cursor: !$hasImage ? "pointer" : "default",
  ...($hasImage
    ? { backgroundPosition: "center", backgroundSize: "cover" }
    : { backgroundColor: "#e0e0e0" }),
}));

const BackgroundImageButton = styled(AddAPhotoIcon)({
  fontSize: "2.5rem",
  cursor: "pointer",
});

const RemoveBackgroundImageButton = styled(CloseIcon)({
  fontSize: "2.5rem",
  cursor: "pointer",
});

const BackgroundImageButtonContainer = styled("div")({
  position: "absolute",
  left: "calc(50% - 20px)",
  top: "calc(50% - 20px)",
});

const AvatarWithInfo = styled(Container)(({ theme }) => ({
  textAlign: "center",
  width: theme.spacing(40),
  margin: "0 auto",
  [theme.breakpoints.up("md")]: {
    margin: 0,
    display: "inline-block",
    width: "auto",
  },
}));

const AvatarContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(-11),
  marginBottom: theme.spacing(2),
  display: "flex",
  justifyContent: "center",
}));

const AccountInfo = styled(Container)(({ theme }) => ({
  padding: 0,
  marginTop: theme.spacing(1),
  [theme.breakpoints.up("md")]: {
    paddingRight: theme.spacing(17),
  },
}));

const InfoElement = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(1),
}));

const ParentOrganizationTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(1),
  color: `${theme.palette.secondary.main}`,
  fontWeight: "bold",
}));

const StyledMiniOrganizationPreview = styled(MiniOrganizationPreview)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(1),
}));

const StyledAutoCompleteSearchBar = styled(AutoCompleteSearchBar)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const Subtitle = styled("div")(({ theme }) => ({
  color: `${theme.palette.secondary.main}`,
  fontWeight: "bold",
}));

const NameTextField = styled(TextField)(({ theme }) => ({
  fontWeight: "bold",
  padding: theme.spacing(1),
  paddingLeft: 0,
  paddingRight: 0,
}));

const NoPaddingContainer = styled(Container)({
  padding: 0,
});

const InfoContainer = styled(Container)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "flex",
  },
  position: "relative",
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
}));

const actionButtonStyles = (theme: Theme) => ({
  position: "absolute" as const,
  right: theme.spacing(1),
  width: theme.spacing(18),
  [theme.breakpoints.down("md")]: {
    width: theme.spacing(14),
    fontSize: 10,
    textAlign: "center" as const,
  },
});

const SaveButton = styled(Button)(({ theme }) => ({
  ...actionButtonStyles(theme),
  top: theme.spacing(11.5),
  [theme.breakpoints.up("md")]: {
    top: theme.spacing(1),
  },
}));

const CancelButton = styled(Button)(({ theme }) => ({
  ...actionButtonStyles(theme),
  top: theme.spacing(16.5),
  [theme.breakpoints.up("md")]: {
    top: theme.spacing(6.5),
  },
}));

const ChipArray = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  padding: theme.spacing(0.5),
}));

const StyledSelectField = styled(SelectField)({
  width: 250,
});

const StyledSelectDialog = styled(SelectDialog)({
  width: 400,
});

const StyledAlert = styled(Alert)({
  textAlign: "center",
  maxWidth: 1280,
  margin: "0 auto",
});

const DeleteMessage = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: theme.spacing(10),
}));

const SpaceStrings = styled("div")({
  width: 4,
});

const CheckTranslationsButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  marginTop: theme.spacing(5),
}));

const DetailledDescriptionContainer = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(5),
}));

const StyledRequiredFieldsNotice = styled(RequiredFieldsNotice)(({ theme }) => ({
  display: "block",
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(3),
}));

//Generic page for editing your personal profile or organization profile
export default function EditAccountPage({
  account,
  possibleAccountTypes,
  maxAccountTypes,
  // object with properties that can be changed and their types (e.g. "summary" is a "text" type)
  //  E.g. for organizations this is generated by the function in public/data/organization_info_metadata.js
  infoMetadata,
  children,
  handleSubmit,
  submitMessage,
  handleCancel,
  errorMessage,
  existingName,
  existingUrlSlug,
  skillsOptions,
  splitName,
  deleteEmail,
  loadingSubmit,
  onClickCheckTranslations,
  allSectors,
  type,
  checkTranslationsRef,
  sectorsTitle,
}: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "account", locale: locale });
  const organizationTexts = getTexts({ page: "organization", locale: locale });
  const imageInputFileRef = useRef<HTMLInputElement | null>(null);
  const closeIconRef = useRef<SVGSVGElement | null>(null);
  const [editedAccount, setEditedAccount] = useState({ ...account });
  const isOrganization = type === "organization";
  const [tempImages, setTempImages] = useState({
    background_image: editedAccount.background_image
      ? editedAccount.background_image
      : DEFAULT_BACKGROUND_IMAGE,
  });

  const [open, setOpen] = useState({
    backgroundDialog: false,
    removeBackgroundDialog: false,
    addTypeDialog: false,
    confirmExitDialog: false,
  });
  const handleDialogClickOpen = (dialogKey) => {
    setOpen({ ...open, [dialogKey]: true });
  };

  const handleBackgroundClose = (image) => {
    setOpen({ ...open, backgroundDialog: false });
    if (image && image instanceof HTMLCanvasElement) {
      if (image && image instanceof HTMLCanvasElement) {
        whitenTransparentPixels(image);
        image.toBlob(async function (blob) {
          const resizedBlob = URL.createObjectURL(blob!);
          setEditedAccount({ ...editedAccount, background_image: resizedBlob });
        }, "image/jpeg");
      }
    }
  };

  const removeBackgroundImage = (confirm: boolean) => {
    if (confirm) {
      setEditedAccount({ ...editedAccount, background_image: null });
    }
    setOpen({ ...open, removeBackgroundDialog: false });
  };

  const handleTextFieldChange = (key, newValue, isInfoElement = false) => {
    if (isInfoElement)
      setEditedAccount({ ...editedAccount, info: { ...editedAccount.info, [key]: newValue } });
    setEditedAccount({ ...editedAccount, [key]: newValue });
  };

  const handleAddTypeClose = (type, additionalInfo) => {
    setOpen({ ...open, addTypeDialog: false });
    const tempAccount = editedAccount;
    if (additionalInfo) {
      for (const info of additionalInfo) {
        tempAccount.info[info.key] = info.value;
      }
      tempAccount.types = [...tempAccount.types, type];
      setEditedAccount(tempAccount);
    }
  };

  const handleConfirmExitClose = (exit) => {
    setOpen({ ...open, confirmExitDialog: false });
    if (exit) handleCancel();
  };

  const deleteFromInfoArray = (key, entry) => {
    setEditedAccount({
      ...editedAccount,
      info: {
        ...editedAccount.info,
        [key]: editedAccount.info[key].filter((val) => val !== entry),
      },
    });
  };

  // Refactored into a proper component
  const InfoArrayDisplay = ({ infoKey, infoEl }) => {
    const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState(
      editedAccount.info.skills ? [...editedAccount.info.skills] : []
    );

    const handleSkillsDialogClose = (skills) => {
      setSkillsDialogOpen(false);
      if (skills)
        setEditedAccount({
          ...editedAccount,
          info: { ...editedAccount.info, skills: skills },
        });
    };

    const handleDeleteFromInfoArray = (entry) => {
      deleteFromInfoArray(infoKey, entry);
      setSelectedItems([...selectedItems.filter((item) => item !== entry)]);
    };

    const handleSkillsDialogClickOpen = () => setSkillsDialogOpen(true);

    return (
      <InfoElement>
        <Subtitle>{infoEl.name}:</Subtitle>
        <ChipArray>
          {selectedItems.map((entry) => (
            <StyledChip
              size="medium"
              color="secondary"
              label={entry.name}
              key={entry.key}
              onDelete={() => handleDeleteFromInfoArray(entry)}
            />
          ))}
          {editedAccount.info[infoKey].length < infoEl.maxEntries && (
            <StyledChip
              label={texts.add}
              icon={<ControlPointIcon />}
              color="primary"
              onClick={handleSkillsDialogClickOpen}
            />
          )}
          <MultiLevelSelectDialog
            open={skillsDialogOpen}
            onClose={() => setSkillsDialogOpen(false)}
            onSave={handleSkillsDialogClose}
            type="skills"
            options={skillsOptions}
            items={editedAccount.info.skills}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
          />
        </ChipArray>
      </InfoElement>
    );
  };

  /**Generates all the possible info a user can put about their account e.g. website, location, summary, bio, ...
     Since this component is generic and is used for both personal profiles and organizations
     we pass an info element to it.
     */
  const displayAccountInfo = (info) => {
    //For each info object we want to return the correct input so users can change this info
    return Object.keys(info).map((key) => {
      const i = getFullInfoElement(infoMetadata, key, info[key]);
      const handleChange = (event) => {
        let newValue = event.target.value;

        if (i.type === "select") {
          //On select fields, use the key as the new value since the text can have multiple languages
          newValue = i.options.find((o) => o.name === event.target.value).key;
        }

        setEditedAccount({
          ...editedAccount,
          info: { ...editedAccount.info, [key]: newValue },
        });
      };

      const handleChangeLocationString = (newLocationString) => {
        setEditedAccount({
          ...editedAccount,
          info: { ...editedAccount.info, [key]: newLocationString },
        });
      };

      //set account.info.location to object when user selects a location
      const handleChangeLocation = (location) => {
        setEditedAccount({
          ...editedAccount,
          info: {
            ...editedAccount.info,
            [key]: parseLocation(location),
          },
        });
      };

      const handleSetParentOrganization = (newOrg) => {
        setEditedAccount({
          ...editedAccount,
          info: {
            ...editedAccount.info,
            parent_organization: newOrg,
            has_parent_organization: !!newOrg,
          },
        });
      };
      //Iterate through potential types of info and display the corresponding input
      if (i.type === "array") {
        return <InfoArrayDisplay key={key} infoKey={key} infoEl={i} />;
      } else if (i.type === "select") {
        return (
          <InfoElement key={key}>
            <StyledSelectField
              color="contrast"
              options={i.options}
              label={i.name}
              defaultValue={{ name: i.value, key: i.value }}
              onChange={handleChange}
            />
          </InfoElement>
        );
      } else if (i.type === "checkbox") {
        return (
          <div key={i.key}>
            <Checkbox
              id={"checkbox" + i.key}
              checked={i.value}
              size="small"
              onChange={(e) => handleChange({ target: { value: e.target.checked } })}
            />
            <label htmlFor={"checkbox" + i.key}>{i.label}</label>
          </div>
        );
      } else if (
        i.type === "auto_complete_searchbar" &&
        i.key === "parent_organization" &&
        (!i.show_if_ticked || editedAccount.info[i.show_if_ticked] === true)
      ) {
        const renderSearchOption = ({ key, ...props }, option) => (
          <li key={key} {...props}>
            {option.name}
          </li>
        );
        return (
          <InfoElement key={i.key}>
            {i.value && (
              <>
                <ParentOrganizationTitle>{texts.parent_organization}:</ParentOrganizationTitle>
                <StyledMiniOrganizationPreview
                  organization={i.value}
                  size="tiny"
                  onDelete={() => handleSetParentOrganization(null)}
                />
              </>
            )}
            <StyledAutoCompleteSearchBar
              label={i.label}
              baseUrl={process.env.API_URL + i.baseUrl}
              freeSolo
              clearOnSelect
              onSelect={handleSetParentOrganization}
              renderOption={renderSearchOption}
              getOptionLabel={(option) => option.name}
              helperText={i.helperText}
            />
          </InfoElement>
        );
      } else if (i.type === "location") {
        return (
          <InfoElement key={i.key}>
            <LocationSearchBar
              label={i.name}
              required
              value={editedAccount.info.location}
              onChange={handleChangeLocationString}
              onSelect={handleChangeLocation}
              handleSetOpen={i.setLocationOptionsOpen}
              open={i.locationOptionsOpen}
              locationInputRef={i.locationInputRef}
            />
          </InfoElement>
        );
      } else if (i.type === "sectors") {
        const onSelectNewSector = (event) => {
          event.preventDefault();
          const sector = allSectors.find((h) => h.name === event.target.value);
          if (editedAccount?.info?.sectors?.filter((s) => s.key === sector.key)?.length === 0) {
            const sectorsAfterAddition = [...editedAccount.info.sectors, sector];
            setEditedAccount({
              ...editedAccount,
              info: {
                ...editedAccount.info,
                sectors: sectorsAfterAddition,
              },
            });
          }
        };

        const onClickRemoveSector = (sector) => {
          const sectorsAfterRemoval = editedAccount?.info?.sectors.filter(
            (s) => s.key !== sector.key
          );
          setEditedAccount({
            ...editedAccount,
            info: {
              ...editedAccount.info,
              sectors: sectorsAfterRemoval,
            },
          });
        };
        return (
          <Fragment key={i.key}>
            <ActiveSectorsSelector
              //TODO(unused) info={i}
              selectedSectors={editedAccount.info.sectors}
              sectorsToSelectFrom={allSectors.filter(
                (s) =>
                  editedAccount?.info?.sectors.filter((addedSectors) => addedSectors.key === s.key)
                    .length === 0
              )}
              onSelectNewSector={onSelectNewSector}
              onClickRemoveSector={onClickRemoveSector}
              title={sectorsTitle}
            />
          </Fragment>
        );
        //This is the fallback for normal textfields
      } else if (key != "parent_organization" && ["text", "bio"].includes(i.type)) {
        // By checking the attribute of the types assigned to an organization, determine if the textfield should be displayed on
        //   the edit account page. Should any of the type's attribute "hide get involved" be true or no type is selected,
        //   we hide the field.

        const hideGetInvolvedField =
          i.key === "get_involved"
            ? editedAccount.types.map((type) => type.hide_get_involved).includes(true) ||
              editedAccount.types.length === 0
            : false;
        return (
          <Fragment key={key}>
            {!hideGetInvolvedField && (
              <InfoElement>
                <TextField
                  required={i.required}
                  label={i.name}
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                  fullWidth
                  inputProps={{ maxLength: i.maxLength }}
                  value={i.value ?? ""}
                  multiline
                  rows={i.rows}
                  onChange={handleChange}
                  helperText={
                    i.showCharacterCounter
                      ? i.helptext +
                        (editedAccount.info[i.key] ? editedAccount.info[i.key].length : 0) +
                        " / " +
                        i.maxLength +
                        " " +
                        texts.characters +
                        ")"
                      : ""
                  }
                  variant="outlined"
                />
              </InfoElement>
            )}
          </Fragment>
        );
      }
    });
  };
  const [isLoading, setIsLoading] = useState(false);
  const onBackgroundChange = async (backgroundEvent) => {
    const file = backgroundEvent.target.files[0];
    if (!file) {
      return;
    }

    try {
      setIsLoading(true);
      handleDialogClickOpen("backgroundDialog");
      const compressedImage = await convertToJPGWithAspectRatio(file);
      setTempImages(() => {
        return {
          ...tempImages,
          background_image: compressedImage,
        };
      });
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeDelete = (typeToDelete) => {
    const tempEditedAccount = { ...editedAccount };
    const fullType = getTypes(possibleAccountTypes, infoMetadata).filter(
      (t) => t.key === typeToDelete
    )[0];
    //The additional info that has to be provided for that type isn't necessary anymore, so we delete it
    if (fullType.additionalInfo) {
      for (const info of fullType.additionalInfo) {
        delete tempEditedAccount.info[info.key];
      }
    }

    tempEditedAccount.types = tempEditedAccount.types.filter((t) => t.key !== typeToDelete);
    setEditedAccount(tempEditedAccount);
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();

    handleSubmit(editedAccount);
  };

  const getDetailledDescription = () => {
    const detailled_description_obj = Object.keys(editedAccount.info).filter((i) => {
      const el = getFullInfoElement(infoMetadata, i, editedAccount.info[i]);
      return el.type === "detailled_description";
    });
    if (detailled_description_obj.length > 0) {
      const key = detailled_description_obj[0];
      return getFullInfoElement(infoMetadata, key, editedAccount.info[key]);
    } else return null;
  };
  const detailledDescription = getDetailledDescription();

  const handleValueChange = (event, key) => {
    setEditedAccount({
      ...editedAccount,
      info: { ...editedAccount.info, [key]: event.target.value },
    });
  };

  const handleAvatarImageChange = (changedImage?: AvatarImage) => {
    setEditedAccount({
      ...editedAccount,
      image: changedImage?.imageUrl || null,
      thumbnail_image: changedImage?.thumbnailImageUrl || null,
    });
  };

  const onClickBackgroundImage = (e) => {
    if (e.target === closeIconRef.current) {
      //If we clicked on the remove image button don't open the interface to change your image
      return;
    } else {
      imageInputFileRef.current?.click();
    }
  };

  return (
    <NoPaddingContainer maxWidth="lg">
      <form onSubmit={handleFormSubmit}>
        {errorMessage && (
          <StyledAlert severity="error">
            {editErrorMessage(
              existingName,
              errorMessage,
              existingUrlSlug,
              isOrganization,
              organizationTexts,
              locale
            )}
          </StyledAlert>
        )}

        <BackgroundContainer
          $hasImage={!!editedAccount.background_image}
          style={
            editedAccount.background_image
              ? { backgroundImage: `url(${editedAccount.background_image})` }
              : undefined
          }
          onClick={editedAccount.background_image ? () => void 0 : onClickBackgroundImage}
        >
          <BackgroundImageButtonContainer>
            <BackgroundImageButton
              onClick={editedAccount.background_image ? onClickBackgroundImage : () => void 0}
            />
            {editedAccount.background_image && (
              <RemoveBackgroundImageButton
                onClick={() => setOpen({ ...open, removeBackgroundDialog: true })}
                ref={closeIconRef}
              />
            )}
          </BackgroundImageButtonContainer>
          <input
            type="file"
            name="backgroundPhoto"
            id="backgroundPhoto"
            ref={imageInputFileRef}
            style={{ display: "none" }}
            onChange={onBackgroundChange}
            accept=".png,.jpeg,.jpg"
          />
        </BackgroundContainer>

        <ConfirmDialog
          open={open.removeBackgroundDialog}
          onClose={removeBackgroundImage}
          title={texts.remove_background_image}
          text={texts.do_you_really_want_to_remove_background_image}
          cancelText={texts.no}
          confirmText={texts.yes}
        />

        <InfoContainer>
          <SaveButton color="primary" variant="contained" type="submit">
            {loadingSubmit ? <ButtonLoader /> : submitMessage ? submitMessage : texts.save}
          </SaveButton>
          <CancelButton
            color="grey"
            variant="contained"
            onClick={() => handleDialogClickOpen("confirmExitDialog")}
          >
            {texts.cancel}
          </CancelButton>

          <AvatarWithInfo>
            <AvatarContainer>
              <UserAvatar
                mode="edit"
                imageUrl={editedAccount.image}
                thumbnailImageUrl={editedAccount.thumbnail_image}
                alternativeText={editedAccount.name}
                onAvatarChanged={handleAvatarImageChange}
              />
            </AvatarContainer>

            {splitName ? (
              <>
                <NameTextField
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                  fullWidth
                  value={editedAccount.first_name}
                  onChange={(event) => handleTextFieldChange("first_name", event.target.value)}
                  multiline
                  required
                  label={texts.first_name}
                />
                <NameTextField
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                  fullWidth
                  value={editedAccount.last_name}
                  onChange={(event) => handleTextFieldChange("last_name", event.target.value)}
                  multiline
                  required
                  label={texts.last_name}
                />
              </>
            ) : (
              <NameTextField
                // @ts-ignore - contrast is a custom color defined in theme
                color="contrast"
                fullWidth
                value={editedAccount.name}
                onChange={(event) => handleTextFieldChange("name", event.target.value)}
                multiline
                required
              />
            )}

            {editedAccount.types && (
              <NoPaddingContainer>
                {possibleAccountTypes &&
                  getTypesOfAccount(
                    editedAccount,
                    possibleAccountTypes,
                    infoMetadata
                  ).map((typeObject) => (
                    <StyledChip
                      color="secondary"
                      label={typeObject.name}
                      key={typeObject.key}
                      onDelete={() => handleTypeDelete(typeObject.key)}
                    />
                  ))}
                {possibleAccountTypes &&
                  getTypesOfAccount(editedAccount, possibleAccountTypes, infoMetadata).length <
                    maxAccountTypes && (
                    <Chip
                      label={texts.add_type}
                      color={
                        editedAccount.types && editedAccount.types.length ? "secondary" : "primary"
                      }
                      icon={<ControlPointIcon />}
                      onClick={() => handleDialogClickOpen("addTypeDialog")}
                    />
                  )}
              </NoPaddingContainer>
            )}
          </AvatarWithInfo>
          <AccountInfo>
            {/*Contains all the possible info a user can put about their account e.g. website, location, summary, bio, ...*/}
            <StyledRequiredFieldsNotice />
            {displayAccountInfo(editedAccount.info)}
            <CheckTranslationsButtonContainer>
              {onClickCheckTranslations && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onClickCheckTranslations(editedAccount)}
                  ref={checkTranslationsRef}
                >
                  {texts.check_translations}
                </Button>
              )}
            </CheckTranslationsButtonContainer>
          </AccountInfo>
        </InfoContainer>
        <DetailledDescriptionContainer>
          {detailledDescription && (
            <DetailledDescriptionInput
              title={detailledDescription.name}
              helpText={detailledDescription.helptext}
              value={detailledDescription.value}
              onChange={handleValueChange}
              infoKey={detailledDescription.key}
            />
          )}
        </DetailledDescriptionContainer>
        {children}
        {deleteEmail && (
          <DeleteMessage variant="subtitle2">
            <InfoOutlinedIcon />
            {texts.if_you_wish_to_delete}
            <SpaceStrings />
            <Link href={`mailto:${deleteEmail}`} underline="hover">
              {deleteEmail}
            </Link>
          </DeleteMessage>
        )}
      </form>
      <UploadImageDialog
        onClose={handleBackgroundClose}
        open={open.backgroundDialog}
        imageUrl={tempImages.background_image}
        height={200}
        mobileHeight={80}
        mediumHeight={120}
        ratio={3}
        loading={isLoading}
        loadingText={texts.processing_image_please_wait}
        PaperProps={{
          sx: {
            maxHeight: "none",
          },
        }}
      />
      {possibleAccountTypes && (
        <StyledSelectDialog
          // SelectDialog types className as required; emotion merges its generated class into it
          className=""
          onClose={handleAddTypeClose}
          open={open.addTypeDialog}
          title={texts.add_type}
          values={getTypes(possibleAccountTypes, infoMetadata).filter(
            (value) => !editedAccount.types.some((val) => val.key === value.key)
          )}
          label={texts.choose_type}
          supportAdditionalInfo={true}
        />
      )}
      <ConfirmDialog
        open={open.confirmExitDialog}
        onClose={handleConfirmExitClose}
        title={texts.exit}
        text={texts.do_you_really_want_to_exit_without_saving}
        cancelText={texts.no}
        confirmText={texts.yes}
      />
    </NoPaddingContainer>
  );
}

const getTypes = (possibleAccountTypes, infoMetadata) => {
  return possibleAccountTypes.map((type) => {
    return {
      ...type,
      additionalInfo: type.additionalInfo.map((info) => {
        return { ...infoMetadata[info], key: info };
      }),
    };
  });
};

const getTypesOfAccount = (account, possibleAccountTypes, infoMetadata) => {
  return getTypes(possibleAccountTypes, infoMetadata).filter((type) =>
    account.types.find((thisType) => thisType.key === type.key)
  );
};

const getFullInfoElement = (infoMetadata, key, value) => {
  return { ...infoMetadata[key], value: value };
};

const editErrorMessage = (
  existingName,
  errorMessage,
  existingUrlSlug,
  isOrganization,
  texts,
  locale
) => {
  // if we are on a profile page or no existing url slug is generated by the error then return the normal error message
  if (!isOrganization || !existingUrlSlug) return errorMessage;
  else {
    const firstSentenceText = texts.someone_has_already_created_organization;
    const secondSentenceText = texts.please_join_org_or_use_diff_name_if_problems_contact;
    return (
      <>
        {firstSentenceText}
        <Link
          href={getLocalePrefix(locale) + "/organizations/" + existingUrlSlug}
          target="_blank"
          underline="hover"
        >
          {existingName}
        </Link>
        {secondSentenceText}
        <Link href="mailto:support@climatehub.org" target="_blank" underline="hover">
          support@climatehub.org
        </Link>
      </>
    );
  }
};
