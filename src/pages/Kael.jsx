import {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  supabaseApi,
} from '@/lib/supabaseApi';

import {
  Button,
} from '@/components/ui/button';

import {
  Textarea,
} from '@/components/ui/textarea';

import {
  Send,
  Zap,
  Lock,
  Pencil,
  X,
} from 'lucide-react';

import {
  cn,
} from '@/lib/utils';

import {
  computeStats,
  incrementMessageCount,
  canSendMessage,
} from '@/lib/messageLimit';

import {
  useAppSettings,
} from '@/lib/AppSettingsContext';

import {
  getKaelSystemPrompt,
} from '@/lib/trainingTypes';

import MessageBubble from '@/components/kael/MessageBubble';


const CONTEXT_MESSAGE_COUNT = 30;


/*
 * ============================================================
 * TYPEWRITER SETTINGS
 * ============================================================
 *
 * Kael starts displaying the answer as soon as the AI result
 * arrives, then reveals it rapidly in small chunks.
 *
 * This is intentionally fast. The goal is for the response to
 * feel immediate without making the text unreadably fast.
 */

const TYPEWRITER_MIN_DELAY = 5;
const TYPEWRITER_MAX_DELAY = 18;

const TYPEWRITER_MAX_DURATION = 5000;


/*
 * Calculate a typing delay based on how much text remains.
 *
 * Short answers:
 *   slightly slower so they still feel natural.
 *
 * Long answers:
 *   progressively faster so a huge response does not take
 *   forever to appear.
 */

function getTypingDelay(
  textLength
) {
  if (
    textLength <= 120
  ) {
    return 12;
  }

  if (
    textLength <= 300
  ) {
    return 9;
  }

  if (
    textLength <= 600
  ) {
    return 7;
  }

  return 5;
}


/*
 * Split text into very small chunks.
 *
 * We use chunks rather than literally one character per render,
 * because rendering every single character can make mobile
 * devices feel sluggish.
 */

function getTypingChunkSize(
  textLength
) {
  if (
    textLength <= 150
  ) {
    return 1;
  }

  if (
    textLength <= 400
  ) {
    return 2;
  }

  if (
    textLength <= 900
  ) {
    return 3;
  }

  return 4;
}


/*
 * Small natural pauses after punctuation.
 * These make the response feel more like deliberate typing.
 */

function getPunctuationPause(
  character
) {
  if (
    character === '.' ||
    character === '!' ||
    character === '?'
  ) {
    return 18;
  }

  if (
    character === ',' ||
    character === ';' ||
    character === ':'
  ) {
    return 8;
  }

  return 0;
}


export default function Kael() {
  const {
    settings,
  } = useAppSettings();


  const [
    user,
    setUser,
  ] = useState(null);


  const [
    messages,
    setMessages,
  ] = useState([]);


  const [
    input,
    setInput,
  ] = useState('');


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    stats,
    setStats,
  ] = useState(null);


  const [
    editingMessage,
    setEditingMessage,
  ] = useState(null);


  const bottomRef =
    useRef(null);


  /*
   * Keeps the Kael input ready for typing.
   *
   * After Kael finishes responding, focus automatically returns
   * to the message box so the user can immediately start typing
   * without clicking it again.
   */
  const inputRef =
    useRef(null);


  /*
   * Used to cancel a typewriter animation if the user sends
   * another message or leaves the page while Kael is typing.
   */

  const typingCancelledRef =
    useRef(false);


  /*
   * ==========================================================
   * LOAD USER
   * ==========================================================
   */

  useEffect(() => {
    let active = true;

    supabaseApi.auth
      .me()
      .then((u) => {
        if (!active) {
          return;
        }

        setUser(u);

        setStats(
          computeStats(
            u,
            u?.subscription_plan ||
              'free'
          )
        );
      })
      .catch((error) => {
        console.error(
          '[KAEL] Failed to load user:',
          error
        );
      });

    return () => {
      active = false;
    };
  }, []);


  /*
   * ==========================================================
   * LOAD CHAT HISTORY
   * ==========================================================
   */

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let active = true;

    supabaseApi.entities.KaelMessage
      .filter(
        {},
        'created_date',
        200
      )
      .then((msgs) => {
        if (active) {
          setMessages(
            Array.isArray(msgs)
              ? msgs
              : []
          );
        }
      })
      .catch((error) => {
        console.error(
          '[KAEL] Failed to load conversation:',
          error
        );
      });

    return () => {
      active = false;
    };
  }, [
    user?.id,
  ]);


  /*
   * ==========================================================
   * KEEP BOTTOM VISIBLE
   * ==========================================================
   *
   * The previous version only watched messages.length, which
   * meant the screen would not necessarily follow Kael while
   * text was being revealed.
   *
   * Now we also watch the actual latest message content.
   */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [
    messages.length,
    loading,
    messages[
      messages.length - 1
    ]?.content,
  ]);


  /*
   * Keep the message box ready for typing.
   *
   * After Kael finishes responding, focus returns to the input
   * automatically so the user can immediately start typing
   * without clicking the box again.
   */

  useEffect(() => {
    if (
      !loading &&
      !editingMessage &&
      !atLimit
    ) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [
    loading,
    editingMessage,
    atLimit,
  ]);


  /*
   * ==========================================================
   * PLAN / MESSAGE LIMIT
   * ==========================================================
   */

  const plan =
    user?.subscription_plan ||
    'free';


  const atLimit =
    stats
      ? stats.remaining === 0
      : false;


  const firstName =
    user?.first_name ||
    user?.full_name?.split(
      ' '
    )[0] ||
    '';


  /*
   * ==========================================================
   * BUILD KAEL PROMPT
   * ==========================================================
   */

  const buildPrompt = (
    history
  ) => {
    const isElite =
      plan === 'elite';

    const trainingType =
      user?.training_type ||
      'calisthenics';

    const lang =
      settings?.language ||
      'English';


    const langInstruction =
      lang !== 'English'
        ? `\n\nCRITICAL: Respond ENTIRELY in ${lang}. Every word of your response must be in ${lang}.`
        : '';


    const recentHistory =
      history
        .slice(
          -CONTEXT_MESSAGE_COUNT
        )
        .map(
          (message) =>
            `${
              message.role ===
              'user'
                ? 'User'
                : 'Kael'
            }: ${message.content}`
        )
        .join('\n\n');


    return `${getKaelSystemPrompt(
      trainingType,
      firstName,
      isElite
    )}${langInstruction}\n\nCONVERSATION HISTORY (remember what the user has told you about their capabilities, limitations, and preferences — update your understanding if they say something new or different):\n${recentHistory}\n\nKael:`;
  };


  /*
   * ==========================================================
   * TYPE THE ASSISTANT RESPONSE
   * ==========================================================
   */

  const typeAssistantResponse =
    async (
      fullText,
      temporaryId
    ) => {

      typingCancelledRef.current =
        false;


      const text =
        String(
          fullText ||
            ''
        );


      if (!text) {
        return;
      }


      const textLength =
        text.length;


      /*
       * Keep the complete visual typing animation under roughly
       * five seconds for normal responses.
       */

      const baseDelay =
        Math.min(
          Math.max(
            getTypingDelay(
              textLength
            ),
            TYPEWRITER_MIN_DELAY
          ),
          TYPEWRITER_MAX_DELAY
        );


      const chunkSize =
        getTypingChunkSize(
          textLength
        );


      /*
       * Safety adjustment:
       * never allow the typewriter to become excessively slow
       * on a long Elite response.
       */

      const estimatedDuration =
        Math.ceil(
          textLength /
            chunkSize
        ) *
          baseDelay;


      const speedMultiplier =
        estimatedDuration >
        TYPEWRITER_MAX_DURATION
          ? TYPEWRITER_MAX_DURATION /
            estimatedDuration
          : 1;


      const delay = Math.max(
        2,
        Math.round(
          baseDelay *
            speedMultiplier
        )
      );


      let visibleText =
        '';


      for (
        let index = 0;
        index < text.length;
        index += chunkSize
      ) {

        if (
          typingCancelledRef.current
        ) {
          return;
        }


        visibleText =
          text.slice(
            0,
            Math.min(
              index +
                chunkSize,
              text.length
            )
          );


        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                temporaryId
                  ? {
                      ...message,
                      content:
                        visibleText,
                    }
                  : message
            )
        );


        const lastCharacter =
          visibleText[
            visibleText.length -
              1
          ];


        const punctuationPause =
          getPunctuationPause(
            lastCharacter
          );


        await new Promise(
          (resolve) =>
            window.setTimeout(
              resolve,
              delay +
                punctuationPause
            )
        );
      }
    };


  /*
   * ==========================================================
   * SEND MESSAGE
   * ==========================================================
   */

  const sendMessage =
    async () => {
      const text =
        input.trim();


      if (
        !text ||
        loading
      ) {
        return;
      }


      const isEditing =
        !!editingMessage;


      if (
        !isEditing &&
        !canSendMessage(
          stats
        )
      ) {
        return;
      }


      typingCancelledRef.current =
        true;


      setInput('');
      setLoading(true);


      try {

        let currentMessages =
          [
            ...messages,
          ];


        /*
         * ----------------------------------------------------
         * HANDLE EDITING
         * ----------------------------------------------------
         */

        if (isEditing) {

          const editIndex =
            messages.findIndex(
              (
                message
              ) =>
                message.id ===
                editingMessage.id
            );


          if (
            editIndex >=
            0
          ) {

            const toDelete =
              messages.slice(
                editIndex
              );


            await Promise.all(
              toDelete.map(
                (
                  message
                ) =>
                  supabaseApi.entities.KaelMessage.delete(
                    message.id
                  )
              )
            );


            currentMessages =
              messages.slice(
                0,
                editIndex
              );


            setMessages(
              currentMessages
            );

          }


          setEditingMessage(
            null
          );
        }


        /*
         * ----------------------------------------------------
         * SAVE USER MESSAGE
         * ----------------------------------------------------
         */

        const userMsg =
          await supabaseApi.entities.KaelMessage.create(
            {
              role:
                'user',

              content:
                text,

              is_edit:
                isEditing,
            }
          );


        currentMessages = [
          ...currentMessages,
          userMsg,
        ];


        setMessages(
          currentMessages
        );


        /*
         * ----------------------------------------------------
         * ASK KAEL
         * ----------------------------------------------------
         */

        const prompt =
          buildPrompt(
            currentMessages
          );


        const response =
          await supabaseApi.ai.invoke(
            {
              type:
                'kael',

              prompt,
            }
          );


        const fullResponse =
          String(
            response ||
              ''
          ).trim();


        if (
          !fullResponse
        ) {
          throw new Error(
            'Kael returned an empty response.'
          );
        }


        /*
         * ----------------------------------------------------
         * CREATE A TEMPORARY ASSISTANT MESSAGE
         * ----------------------------------------------------
         *
         * This message appears immediately and is gradually
         * filled with the actual AI response.
         */

        const temporaryId =
          `_typing_${Date.now()}`;


        const temporaryAssistant =
          {
            id:
              temporaryId,

            role:
              'assistant',

            content:
              '',
          };


        setMessages(
          (previous) => [
            ...previous,
            temporaryAssistant,
          ]
        );


        /*
         * ----------------------------------------------------
         * TYPE THE RESPONSE
         * ----------------------------------------------------
         */

        await typeAssistantResponse(
          fullResponse,
          temporaryId
        );


        /*
         * ----------------------------------------------------
         * SAVE FINAL ASSISTANT MESSAGE
         * ----------------------------------------------------
         */

        if (
          typingCancelledRef.current
        ) {
          return;
        }


        const assistantMsg =
          await supabaseApi.entities.KaelMessage.create(
            {
              role:
                'assistant',

              content:
                fullResponse,
            }
          );


        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                temporaryId
                  ? assistantMsg
                  : message
            )
        );


        /*
         * Only count a brand-new user message.
         * Editing remains free just as before.
         */

        if (
          !isEditing
        ) {
          const newStats =
            await incrementMessageCount(
              plan
            );

          setStats(
            newStats
          );
        }

      } catch (
        error
      ) {

        console.error(
          '[KAEL] Message failed:',
          error
        );


        /*
         * Remove an empty temporary response if one exists.
         */

        setMessages(
          (previous) =>
            previous.filter(
              (
                message
              ) =>
                !String(
                  message.id
                ).startsWith(
                  '_typing_'
                )
            )
        );


        window.setTimeout(
          () => {
            window.alert(
              error?.message ||
                'Kael could not respond right now. Please try again.'
            );
          },
          0
        );

      } finally {
        setLoading(false);
      }
    };


  /*
   * ==========================================================
   * EDIT MESSAGE
   * ==========================================================
   */

  const handleEdit =
    (message) => {
      if (
        loading ||
        !message ||
        message.role !==
          'user'
      ) {
        return;
      }

      setEditingMessage(
        message
      );

      setInput(
        message.content ||
          ''
      );

      window.setTimeout(
        () => {
          inputRef.current?.focus();
        },
        0
      );
    };


  /*
   * ==========================================================
   * CANCEL EDIT
   * ==========================================================
   */

  const cancelEdit =
    () => {
      setEditingMessage(
        null
      );

      setInput('');

      window.setTimeout(
        () => {
          inputRef.current?.focus();
        },
        0
      );
    };


  /*
   * ==========================================================
   * KEYBOARD HANDLING
   * ==========================================================
   */

  const handleKeyDown =
    (event) => {
      if (
        event.key ===
          'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();

        sendMessage();
      }
    };


  /*
   * ==========================================================
   * GREETING
   * ==========================================================
   */

  const greeting = {
    id:
      'kael-greeting',

    role:
      'assistant',

    content:
      `Hey${
        firstName
          ? ` ${firstName}`
          : ''
      } — I'm Kael. What's on your mind?`,
  };


  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div
      className="
        flex
        flex-col
        h-[calc(100vh-4rem)]
        bg-background
      "
    >

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="
        flex-shrink-0
        px-4
        py-3
        border-b
        border-border
        bg-card/80
        backdrop-blur-sm
      ">

        <div className="
          flex
          items-center
          justify-between
          gap-3
        ">

          <div className="
            flex
            items-center
            gap-3
          ">

            <div className="
              w-10
              h-10
              rounded-2xl
              bg-primary/15
              flex
              items-center
              justify-center
              flex-shrink-0
            ">

              <Zap className="
                w-5
                h-5
                text-primary
              " />

            </div>


            <div>

              <h1 className="
                font-heading
                font-bold
                text-lg
              ">
                Kael
              </h1>

              <p className="
                text-[10px]
                text-muted-foreground
              ">
                Your AI fitness coach
              </p>

            </div>

          </div>


          <div className="
            flex
            items-center
            gap-2
          ">

            {stats && (
              <span className="
                text-[10px]
                text-muted-foreground
                whitespace-nowrap
              ">
                {stats.remaining}{' '}
                msg left
              </span>
            )}

          </div>

        </div>

      </div>


      {/* ======================================================
          MESSAGES
          ====================================================== */}

      <div className="
        flex-1
        overflow-y-auto
        px-4
        py-4
        space-y-4
      ">

        {messages.length ===
          0 &&
          !loading && (
            <MessageBubble
              msg={
                greeting
              }
              isUser={
                false
              }
              canEdit={
                false
              }
            />
          )}


        {messages.map(
          (message) => {

            const isTypingMessage =
              String(
                message.id
              ).startsWith(
                '_typing_'
              );


            return (
              <div
                key={
                  message.id
                }
                className={
                  isTypingMessage
                    ? 'kael-typing-message'
                    : undefined
                }
              >

                <MessageBubble
                  msg={
                    message
                  }
                  isUser={
                    message.role ===
                    'user'
                  }
                  onEdit={
                    handleEdit
                  }
                  canEdit={
                    !loading &&
                    !editingMessage &&
                    !isTypingMessage
                  }
                />

              </div>
            );
          }
        )}


        {/* Waiting for the AI before text starts appearing */}

        {loading &&
          !messages.some(
            (message) =>
              String(
                message.id
              ).startsWith(
                '_typing_'
              )
          ) && (
            <div className="
              flex
              justify-start
            ">

              <div className="
                w-7
                h-7
                rounded-xl
                bg-primary/15
                flex
                items-center
                justify-center
                gap-1
              ">

                <div className="
                  w-1.5
                  h-1.5
                  bg-muted-foreground/60
                  rounded-full
                  animate-bounce
                " />


                <div className="
                  w-1.5
                  h-1.5
                  bg-muted-foreground/60
                  rounded-full
                  animate-bounce
                  [animation-delay:150ms]
                " />


                <div className="
                  w-1.5
                  h-1.5
                  bg-muted-foreground/60
                  rounded-full
                  animate-bounce
                  [animation-delay:300ms]
                " />

              </div>

            </div>
          )}


        <div
          ref={
            bottomRef
          }
        />

      </div>


      {/* ======================================================
          LIMIT NOTICE
          ====================================================== */}

      {atLimit &&
        !editingMessage && (
          <div className="
            mx-4
            mb-2
            p-4
            rounded-2xl
            bg-destructive/10
            border
            border-destructive/30
            flex
            items-start
            gap-3
          ">

            <Lock className="
              w-4
              h-4
              text-destructive
              mt-0.5
              flex-shrink-0
            " />


            <div>

              <p className="
                text-sm
                font-semibold
                text-destructive
              ">
                Monthly limit reached
              </p>


              <p className="
                text-xs
                text-muted-foreground
                mt-0.5
              ">
                You've used all{' '}
                {
                  stats?.limit
                }{' '}
                messages this month.
                Upgrade your plan to keep
                chatting with Kael. Resets
                at the start of next month.
              </p>

            </div>

          </div>
        )}


      {/* ======================================================
          RESET NOTE
          ====================================================== */}

      {stats &&
        !atLimit && (
          <p className="
            text-[10px]
            text-muted-foreground
            text-center
            pb-1
            px-4
          ">
            {
              stats.remaining
            }{' '}
            of{' '}
            {
              stats.limit
            }{' '}
            messages left · resets monthly
          </p>
        )}


      {/* ======================================================
          EDITING INDICATOR
          ====================================================== */}

      {editingMessage && (
        <div className="
          mx-4
          mb-1
          flex
          items-center
          gap-2
          text-xs
          text-primary
          bg-primary/10
          border
          border-primary/20
          rounded-lg
          px-3
          py-1.5
        ">

          <Pencil className="
            w-3
            h-3
            shrink-0
          " />


          <span>
            Editing message — resubmit won't count against your limit
          </span>


          <button
            type="button"
            onClick={
              cancelEdit
            }
            className="
              ml-auto
              p-0.5
              hover:text-foreground
            "
            aria-label="Cancel edit"
          >

            <X className="
              w-3.5
              h-3.5
            " />

          </button>

        </div>
      )}


      {/* ======================================================
          INPUT
          ====================================================== */}

      <div className="
        px-4
        pt-2
        border-t
        border-border
        bg-card/50
        backdrop-blur-sm
        flex-shrink-0
        pb-[calc(6rem_+_env(safe-area-inset-bottom))]
        sm:pb-4
      ">

        <div className="
          flex
          gap-2
          items-end
        ">

          <Textarea
            ref={
              inputRef
            }
            value={
              input
            }
            onChange={
              (event) =>
                setInput(
                  event.target.value
                )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder={
              atLimit &&
              !editingMessage
                ? 'Upgrade to keep chatting…'
                : 'Ask Kael anything…'
            }
            disabled={
              (
                atLimit &&
                !editingMessage
              ) ||
              loading
            }
            className="
              flex-1
              min-h-[44px]
              max-h-32
              resize-none
              rounded-2xl
              border-border
              bg-muted/50
              text-sm
              py-3
              px-4
            "
            rows={1}
          />


          <Button
            type="button"
            size="icon"
            className="
              h-11
              w-11
              rounded-2xl
              flex-shrink-0
            "
            disabled={
              !input.trim() ||
              loading ||
              (
                atLimit &&
                !editingMessage
              )
            }
            onClick={
              sendMessage
            }
          >

            {editingMessage ? (
              <Pencil className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}

          </Button>

        </div>

      </div>

    </div>
  );
}
