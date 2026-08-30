const result =
  await supabaseApi.ai.invoke({
    type: 'food_scan',

    prompt: `
You are Kael's nutrition-analysis system for Washek Fitness.

Analyze the supplied food photograph.

Identify every distinct visible food item.

For each food:
- give the most specific reasonable food name
- estimate the visible serving size
- estimate calories
- estimate protein grams
- estimate carbohydrate grams
- estimate fat grams

Be realistic and conservative.
Do not invent hidden ingredients.
Do not claim exact nutrition from a photograph.
Use reasonable visual estimates.

Return ONLY valid JSON.
Do not use markdown.
Do not put the JSON inside a code block.

Use exactly this structure:

{
  "foods": [
    {
      "food_name": "string",
      "serving_size": "string",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ]
}
`,

    file_urls: [
      imageUrl,
    ],
  });
