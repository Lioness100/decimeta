module.exports = async (req, res) => {
	const body = {
		model: 'gpt-3.5-turbo-0613',
		messages: [
			{
				role: 'user',
				content: `You are an AI librarian. Please assist in providing a list of Dewey Decimal Classification (DDC) numbers (max 3) ranked by their relevance for the user's query: '${req.body.prompt}'. Each entry in the list should include the classification number as a string with its description (ex "636.7 Dogs", format: "<number> <label>".) and the associated breadcrumb. For example, if the item was Dogs, you might say '600 Technology > 630 Agriculture and related technologies > 636 Animal husbandry > 636.7 Dogs'. Any additional context or explanations that may be helpful, especially if there are multiple valid classifications or if the classification might be controversial. This must not be used for restating or introducing the results. This must be supplied if there are multiple results with the same name but different number, to explain the differences.`,
			},
		],
		functions: [
			{
				name: 'output_formatter',
				description: 'Output formatter. Should always be used to format your response to the user.',
				parameters: {
					type: 'object',
					properties: {
						results: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									number: {
										type: 'string',
										description: 'The Dewey Decimal Classification (DDC) number.',
									},
									label: {
										type: 'string',
										description: 'The label associated with the DDC number.',
									},
									breadcrumb: {
										type: 'string',
										description: 'The breadcrumb associated with the DDC number.',
									},
								},
								required: ['number', 'label', 'breadcrumb'],
								minItems: 1,
								maxItems: 3,
							},
						},
						context: {
							type: 'string',
							description:
								'Any additional context or explanations that may be helpful, especially if there are multiple valid classifications or if the classification might be controversial. This must not be used for restating or introducing the results. This must be supplied if there are multiple results with the same name but different number, to explain the differences. Keep it short and concise (the fewer words the better).',
						},
						tip: {
							type: 'string',
							description:
								'Optionally, a tip to display to the user, telling them how to improve their query to get a more accurate response. Keep it short and concise (the fewer words the better).',
						},
					},
					required: ['result'],
				},
			},
		],
		function_call: {
			name: 'output_formatter',
		},
	};

	const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
	});

	const json = await openaiRes.json();

	try {
		return res.status(200).json(JSON.parse(json.choices[0].message.function_call.arguments));
	} catch {
		throw new Error(`Failed to parse response from OpenAI API. JSON:\n${JSON.stringify(json)}`);
	}
};
