import {
  Box,
  Button,
  ChevronDownIcon,
  FormField,
  MultilineInput,
  NumberInput,
  Rows,
  ProgressBar,
  Placeholder,
  ImageCard,
  Masonry,
  MasonryItem,
  Text,
  Title,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
} from "@canva/app-ui-kit";
import type {
  Dimensions,
  NativeTextElementWithBox
} from "@canva/design";
import {
  Font,
  FontStyle,
  FontWeightName,
  requestFontSelection,
  upload
} from "@canva/asset";
import {addNativeElement, addPage, getDefaultPageDimensions, ui } from "@canva/design";
import { CanvaError } from "@canva/error";
import { auth } from "@canva/user";
import React, { useState } from "react";
import pThrottle from 'p-throttle';
import styles from "styles/components.css";
import { generatePlaceholders } from "./utils";

const BACKEND_URL = `${BACKEND_HOST}/gemini`;
const BACKEND_PEXEL_URL = `${BACKEND_HOST}/pexel`;
const TARGET_ROW_HEIGHT_PX = 130;
const NUM_PLACEHOLDERS = 10;

type State = "idle" | "loading" | "success" | "error";

type TextConfig = {
  text: string;
  color: string;
  fontWeight: FontWeightName;
  fontStyle: FontStyle;
};

type Slide = {
  name: string;
  content: string;
  images: string | undefined;
  link: string | undefined;
}

type Image = {
  title: string;
  url: string;
  thumbnailUrl: string;
  height: number;
  width: number;
};

const initialConfig: TextConfig = {
  text: "Hello world",
  color: "#8B3DFF",
  fontWeight: "normal",
  fontStyle: "normal",
};

const getFontWeights = (
  font?: Font
): {
  value: FontWeightName;
  label: FontWeightName;
}[] => {
  return font
    ? font.weights.map((w) => ({
        value: w.weight,
        label: w.weight,
      }))
    : [];
};

const getFontStyles = (
  fontWeight: FontWeightName,
  font?: Font
): {
  value: FontStyle;
  label: FontStyle;
}[] => {
  return font
    ? font.weights
        .find((w) => w.weight === fontWeight)
        ?.styles.map((s) => ({ value: s, label: s })) ?? []
    : [];
};

export const Placeholders = generatePlaceholders({
  numPlaceholders: NUM_PLACEHOLDERS,
  height: TARGET_ROW_HEIGHT_PX,
}).map((placeholder, index) => (
  <MasonryItem
    targetWidthPx={placeholder.width}
    targetHeightPx={placeholder.height}
    key={`placeholder-${index}`}
  >
    <Placeholder shape="rectangle" />
  </MasonryItem>
));

// Default App
export const App = () => {
  // variables
  const [state, setState] = useState<State>("idle");
  const [generatorState, setGeneratorState] = useState<State>("idle");
  const [pexelState, setPexelState] = useState<State>("idle");
  const [prompt, setPrompt] = useState<string>("The Future of Remote Work In Cafe");
  const [respond, setRespond] = useState<string>("");
  const [query, setQuery] = useState<string>("Working in cafe");

  const [error, setError] = React.useState<string | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<number>(0);
  const [slidesNo, setSlidesNo] = React.useState<number | undefined>(5);
  const [defaultPageDimensions, setDefaultPageDimensions] = React.useState<
    Dimensions | undefined
  >();

  const [textConfig, setTextConfig] = React.useState<TextConfig>(initialConfig);
  const [selectedFont, setSelectedFont] = React.useState<Font | undefined>(
    undefined
  );

  const [keyTopic, setKeyTopic] = React.useState<string | undefined>(prompt);

  const [images, setImages] = React.useState<Image[]>([]);

  // get page dimension helper
  React.useEffect(() => {
    getDefaultPageDimensions().then((dimensions) => {
      // Dimensions are undefined if the user is in an unbounded design (e.g. Whiteboard).
      if (!dimensions) {
        setError(
          "Adding pages in unbounded documents, such as Whiteboards, is not supported."
        );
      }
      setDefaultPageDimensions(dimensions);
    });
  }, []);

  // get list of fonts helper
  const { text, fontWeight } = textConfig;
  const disabled = text.trim().length === 0;
  const resetSelectedFontStyleAndWeight = (selectedFont?: Font) => {
    setTextConfig((prevState) => {
      return {
        ...prevState,
        fontStyle:
          getFontStyles(fontWeight, selectedFont)[0]?.value || "normal",
        fontWeight: getFontWeights(selectedFont)[0]?.value || "normal",
      };
    });
  };

  // throttle api helper
  const throttle = pThrottle({
    limit: 1,
    interval: 4000
  });

  const hourlyThrottle = pThrottle({
    limit: 200,
    interval: 3600 * 1000 // 1 hour in milliseconds
  });

  // get center text group alignment
  const centerTextGroup = (textWidth: number, parentWidth: number) => {
    return (parentWidth - textWidth) / 2;
  }

  // canva native text elements helper
  const addText = async (value: string) => {
    await addNativeElement({
      type: "TEXT",
      children: [value],
      fontSize: 24,
      width: 1000,
      top: 40,
      left: 40,
      color: "#000000",
      fontRef: selectedFont?.ref
    });
  }

  // canva upload image helper
  const uploadImage = async (image: Image) => {
    const uploadedImage = await upload({
      type: "IMAGE",
      mimeType: "image/jpeg",
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      width: image.width,
      height: image.height,
    });

    return uploadedImage;
  }

  // canva native image element helper
  const addImageToDesign = async (image: Image) => {
    const queuedImage = await uploadImage(image);

    await addNativeElement({
      type: "IMAGE",
      ref: queuedImage.ref,
    });
  };

  // pexel masonry helper
  const Images = images.map((image, index) => (
    <MasonryItem
      targetWidthPx={image.width}
      targetHeightPx={image.height}
      key={`MasonryItem-${index}`}
    >
      <ImageCard
        ariaLabel="Add image to design"
        onClick={() => addImageToDesign(image)}
        thumbnailUrl={image.url}
        alt={image.title}
        onDragStart={(event: React.DragEvent<HTMLElement>) =>
          ui.startDrag(event, {
            type: "IMAGE",
            resolveImageRef: () => uploadImage(image),
            previewUrl: image.thumbnailUrl,
            previewSize: {
              width: Math.round((130 / image.height) * image.width),
              height: 130,
            },
            fullSize: {
              width: image.width,
              height: image.height,
            },
          })
        }
      />
    </MasonryItem>
  ));

  // create page element
  const headerTextElement = (content: string): NativeTextElementWithBox => ({
    type: "TEXT",
    children: [content],
    color: "#000000",
    fontSize: 72,
    fontWeight: "bold",
    textAlign: "start",
    fontRef: selectedFont?.ref,
    width: 1500,
    top: 0,
    left: 0,
  });

  // create content text element
  const contentTextElement = (content: string): NativeTextElementWithBox => ({
    type: "TEXT",
    children: [content],
    color: "#000000",
    fontSize: 48,
    textAlign: "start",
    fontRef: selectedFont?.ref,
    width: 1500,
    top: 0,
    left: 0,
  });

  // add slides
  const addSlide = async (
    title: string,
    header: NativeTextElementWithBox,
    content: NativeTextElementWithBox
  ) => {
    setIsLoading(true);
    try {
      // Dimensions are undefined if the user is in an unbounded design (e.g. Whiteboard).
      if (!defaultPageDimensions) {
        return;
      }
      setError(undefined);

      const elements = [
        {
          ...header,
          height: "auto",
          top: defaultPageDimensions.height * 0.1,
          left: defaultPageDimensions.width * 0.1
        },
        {
          ...content,
          height: "auto",
          top: defaultPageDimensions.height * 0.3,
          left: defaultPageDimensions.width * 0.1
        }
      ];

      await throttledAddPage({
        title,
        elements,
      });

      setError(undefined);
    } catch (e) {
      if (e instanceof CanvaError) {
        switch (e.code) {
          case "QUOTA_EXCEEDED":
            setError(
              "Sorry, you cannot add any more pages. Please remove an existing page and try again."
            );
            break;
          case "RATE_LIMITED":
            setError(
              "Sorry, you can only add up to 3 pages per second. Please try again."
            );
            break;
          default:
            setError(e.message);
            break;
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // add multiple slides
  const addSlides = async (slides: Slide[]) => {
    if (slides && slides.length > 0) {
      let slidesLeft = slides.length;
      setProgress(0);
      slides.forEach(async (slide) => {
        const name = slide.name;
        const header = headerTextElement(slide.name);
        const content = contentTextElement(slide.content);
        await addSlide(name, header, content);
        slidesLeft--;
        let progress = ((slides.length - slidesLeft) / slides.length) * 100;
        setProgress(progress);
      });
    }
  };

  // send backend request (GEMINI)
  const sendRequest = async () => {
    try {
      setState("loading");
      const token = await auth.getCanvaUserToken();
      const res = await fetch(BACKEND_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({ prompt: `${prompt}` }),
      });

      const body = await res.json();
      setState("success");
      setRespond(body.result);
    } catch (error) {
      setState("error");
      console.error(error);
    }
  };

  // send backend request for pitch slides (GEMINI)
  const sendRequestPitch = async () => {
    try {
      setState("loading");
      const token = await auth.getCanvaUserToken();
      const res = await fetch(BACKEND_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          prompt: `${keyTopic}`,
          type: `pitch`,
          slides: `${slidesNo}`
        }),
      });

      const body = await res.json();
      console.log(body.result);
      const result = body ? JSON.parse(body.result) : [];
      console.log(`Generated ${result.length} slides.`);
      setState("success");
      result && addSlides(result);
    } catch (error) {
      setState("error");
      console.error(error);
    }
  };

  // send backend request for multiple photos (PEXEL)
  const sendPexelMasonryRequest = async () => {
    try {
      setPexelState("loading");
      const token = await auth.getCanvaUserToken();
      const res = await fetch(BACKEND_PEXEL_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({ query: `${query}`, items: 10 }),
      });

      const body = await res.json();
      console.log(body);

      // add masonry images
      if(body.result.photos){
        const images = body.result.photos.map(photo => {
          return {
            title: photo.alt,
            url: photo.src.original,
            thumbnailUrl: photo.src.small,
            height: photo.height,
            width: photo.width,
          };
        });

        console.log(images);

        setImages(images)
      }

      setPexelState("success");
    } catch (error) {
      setPexelState("error");
      console.error(error);
    }
  };

  // limit pexel api calls
  const throttledAddPage = throttle(addPage);
  const throttleGetMasonryPexel = hourlyThrottle(sendPexelMasonryRequest);


  // app render output / UI
  return (
    <div className={styles.scrollContainer}>
      <Tabs>
        <Rows spacing="3u">
          <TabList>
            <Tab id="advisor">
              Advisor
            </Tab>
            <Tab id="pexel">
              Pexel
            </Tab>
            <Tab id="pitch">
              Pitch
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel id="advisor">
              <Rows spacing="2u">
                <Text>
                  Get expert guidance and tools for a successful hackathon here.
                </Text>
                {/* GEMINI AI */}
                <Box padding="3u"  border="low" borderRadius="standard" background="contrast">
                  <Rows spacing="3u">
                    {/* Idle and loading state */}
                    {state !== "error" && (
                      <>
                        <FormField
                          control={props => (
                            <MultilineInput
                              {...props}
                              value={prompt}
                              onChange={(value) => {setPrompt(value)}}
                              minRows={3}
                              autoGrow />
                          )}
                          label="Hackathon AI Advisor"
                          description="Get an expert opinion based on Gemini AI."
                        />
                        <Button
                          variant="primary"
                          onClick={sendRequest}
                          loading={state === "loading"}
                          stretch
                        >
                          Ask Expert Advice
                        </Button>
                        {respond && (
                            <MultilineInput
                            value={respond}
                            minRows={5}
                            readOnly
                            autoGrow />
                        )}
                      </>
                    )}
                    {/* Error state */}
                    {state === "error" && (
                      <Rows spacing="3u">
                        <Rows spacing="1u">
                          <Title size="small">Something went wrong</Title>
                          <Text>To see the error, check the JavaScript Console.</Text>
                        </Rows>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setState("idle");
                          }}
                          stretch
                        >
                          Reset
                        </Button>
                      </Rows>
                    )}
                  </Rows>
                </Box>
              </Rows>
            </TabPanel>
            <TabPanel id="pexel">
              <Rows spacing="3u">
                <Text>
                Find and drag stock images from Pexel into your design.
                </Text>
                <Box>
                  <Rows spacing="3u">
                    {/* Idle and loading state */}
                    {pexelState !== "error" && (
                      <>
                        <FormField
                          control={props => (
                            <MultilineInput
                              {...props}
                              value={query}
                              onChange={(value) => {setQuery(value)}}
                              autoGrow />
                          )}
                          label="Pexel Image Query"
                        />
                        <Button
                          variant="primary"
                          onClick={throttleGetMasonryPexel}
                          loading={pexelState === "loading"}
                          stretch
                        >
                          Find Photos
                        </Button>
                      </>
                    )}
                    {(pexelState === "loading" || Images.length > 0) && (
                      <Rows spacing="3u">
                        <Masonry targetRowHeightPx={TARGET_ROW_HEIGHT_PX}>
                          {[...Images, ...(pexelState === "loading" ? Placeholders : [])]}
                        </Masonry>
                      </Rows>
                    )}
                    {/* Error state */}
                    {pexelState === "error" && (
                      <Rows spacing="3u">
                        <Rows spacing="1u">
                          <Title size="small">Something went wrong</Title>
                          <Text>To see the error, check the JavaScript Console.</Text>
                        </Rows>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setPexelState("idle");
                          }}
                          stretch
                        >
                          Reset
                        </Button>
                      </Rows>
                    )}
                  </Rows>
                </Box>
              </Rows>
            </TabPanel>
            <TabPanel id="pitch">
              <Rows spacing="3u">
                <Text>
                  Pitch generator that is loosely based on 10-20-30
                  Guy Kawasaki picthing rule deck.
                </Text>
                {/* SELECT DEFAULT FONT */}
                <Box>
                  <Rows spacing="2u">
                    <Button
                      variant="secondary"
                      icon={ChevronDownIcon}
                      iconPosition="end"
                      alignment="start"
                      stretch={true}
                      onClick={async () => {
                        const response = await requestFontSelection({
                          selectedFontRef: selectedFont?.ref,
                        });
                        if (response.type === "COMPLETED") {
                          setSelectedFont(response.font);
                          resetSelectedFontStyleAndWeight(response.font);
                        }
                      }}
                      disabled={disabled}
                    >
                      {selectedFont?.name || "Select default font"}
                    </Button>
                  </Rows>
                </Box>
                {/* PITCH GENERATOR */}
                <Box>
                  <Rows spacing="3u">
                    {/* Idle and loading state */}
                    {generatorState !== "error" && (
                      <>
                        <FormField
                          control={props => (
                            <MultilineInput
                              {...props}
                              value={keyTopic}
                              onChange={(value) => {setKeyTopic(value)}}
                              autoGrow />
                          )}
                          description="Enter your hackathon topic to generate pitch slides"
                          label="Hackathon Topic"
                        />
                        <FormField
                          control={props => (
                            <NumberInput
                              {...props}
                              decrementAriaLabel="Decrease slide"
                              defaultValue={slidesNo}
                              onChange={(value) => {setSlidesNo(value)}}
                              hasSpinButtons
                              incrementAriaLabel="Add slide"
                              step={1}
                            />
                          )}
                          label="Number of slides"
                        />
                        <Button
                          variant="primary"
                          onClick={sendRequestPitch}
                          loading={state === "loading" || (progress > 0 && progress < 100)}
                          stretch
                        >
                          Generate Pitch
                        </Button>
                      </>
                    )}
                    {/* Error state */}
                    {generatorState === "error" && (
                      <Rows spacing="3u">
                        <Rows spacing="1u">
                          <Title size="small">Something went wrong</Title>
                          <Text>To see the error, check the JavaScript Console.</Text>
                        </Rows>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setGeneratorState("idle");
                          }}
                          stretch
                        >
                          Reset
                        </Button>
                      </Rows>
                    )}
                    {/* Progress */}
                    {progress > 0 && progress < 100 &&(
                      <Rows spacing="3u">
                        <ProgressBar
                          size="medium"
                          tone="info"
                          value={progress}
                        />
                      </Rows>
                    )}
                  </Rows>
                </Box>
              </Rows>
            </TabPanel>
          </TabPanels>
        </Rows>
      </Tabs>
    </div>
  );
};