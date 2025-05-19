import React from 'react';
import { Formik, Form, Field, FieldArray, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import AppApi from "../../api/app.api";

const validationSchema = Yup.object({
   question: Yup.string()
      .max(100, 'Question must be 100 characters or less')
      .required('Poll question is required'),
   options: Yup.array()
      .of(
         Yup.string()
            .min(1, 'Option cannot be empty')
            .max(100, 'Option must be 100 characters or less')
            .required('Option is required')
      )
      .min(2, 'At least two options are required'),
   expiresAt: Yup.date()
      .required('Expire date is required')
      .min(new Date(), 'Expire date must be in the future'),
});

const CreatePollForm = () => {
   return (
      <Formik
         initialValues={{
            question: '',
            options: ['', ''],
            expiresAt: '',
         }}
         validationSchema={validationSchema}
         onSubmit={async (values, { setSubmitting, resetForm }) => {
            try {
               await AppApi.createPoll(values);
               resetForm();
            } catch (error) {
               console.log("Failed to create poll.");
            } finally {
               setSubmitting(false);
            }
         }}
      >
         {({ values, isSubmitting }) => (
            <Form className="max-w-lg mx-auto bg-white p-8 space-y-6">
               <div className="mb-8 text-center">
                  <h1 className="text-3xl font-extrabold text-blue-700 mb-2">Create a New Poll</h1>
                  <p className="text-gray-600">Easily create and share a poll with your friends or team.</p>
               </div>
               <div>
                  <label htmlFor="question" className="block text-gray-700 font-bold mb-2">
                     Poll Question
                  </label>
                  <Field
                     id="question"
                     name="question"
                     type="text"
                     className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <ErrorMessage
                     name="question"
                     component="div"
                     className="text-red-500 text-sm mt-1"
                  />
               </div>

               <div>
                  <label className="block text-gray-700 font-bold mb-2">Options</label>
                  <FieldArray name="options">
                     {arrayHelpers => (
                        <div className="space-y-2">
                           {values.options && values.options.length > 0 ? (
                              values.options.map((option, idx) => (
                                 <div key={idx} className="flex items-center space-x-2">
                                    <div className='flex flex-col flex-1'>
                                       <Field
                                          name={`options[${idx}]`}
                                          type="text"
                                          className=" border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                          placeholder={`Option ${idx + 1}`}
                                       />
                                       <ErrorMessage
                                          name={`options[${idx}]`}
                                          component="small"
                                          className="text-red-500 text-sm mt-1"
                                       />
                                    </div>
                                    {values.options.length > 2 && (
                                       <button
                                          type="button"
                                          className="text-red-500 px-2 py-1 rounded hover:bg-red-100"
                                          onClick={() => arrayHelpers.remove(idx)}
                                          title="Remove option"
                                       >
                                          &times;
                                       </button>
                                    )}
                                 </div>
                              ))
                           ) : null}
                           <button
                              type="button"
                              className="mt-2 bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
                              onClick={() => arrayHelpers.push('')}
                           >
                              Add Option
                           </button>
                        </div>
                     )}
                  </FieldArray>
               </div>

               <div>
                  <label htmlFor="expiresAt" className="block text-gray-700 font-bold mb-2">
                     Expire Date
                  </label>
                  <Field
                     id="expiresAt"
                     name="expiresAt"
                     type="datetime-local"
                     className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <ErrorMessage
                     name="expiresAt"
                     component="div"
                     className="text-red-500 text-sm mt-1"
                  />
               </div>

               <button
                  type="submit"
                  className={`w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition flex items-center justify-center ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={isSubmitting}
               >
                  {isSubmitting ? (
                     <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        Creating...
                     </>
                  ) : (
                     "Create Poll"
                  )}
               </button>
            </Form>
         )}
      </Formik>
   );
};

export default CreatePollForm;